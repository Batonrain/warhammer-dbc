// test/apps/craft-workshop-research.test.mjs
//
// Итог проекта-Исследования (module/rules/research-findings.mjs), доведённый
// до конца внутри _rollShift: когда Банк заполняется ИМЕННО этой сменой,
// Мастерская создаёт предмет-находку (кроме «Изучения» — книга
// противопоставляет его созданию знания) и всегда дописывает Журнал
// Исследований (флаг крафтера). Та же модель, что у craft-workshop.test.mjs,
// но крафтер здесь умеет getFlag/setFlag/createEmbeddedDocuments — обычный
// crafterActor() там этого не делает, и craft-режим (другие тесты файла) в
// этом не нуждается.

import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { CraftWorkshop } from "../../module/apps/craft-workshop.mjs";
import { RESEARCH_JOURNAL_FLAG, PSYCHIC_RESULT_TYPES } from "../../module/rules/research-findings.mjs";

function researchCrafterActor() {
  const flags = {};
  return {
    id: "crafter-1", name: "Крейн",
    items: [],
    system: {
      characteristics: { int: { total: 40 } },
      skills: { techUse: { total: 50, rank: "trained" } },
      groupSkills: {},
      fatigue: { value: 0 },
    },
    update: async () => {},
    getFlag: (scope, key) => flags[scope]?.[key],
    setFlag: async (scope, key, value) => { (flags[scope] ??= {})[key] = value; },
    createEmbeddedDocuments: async (type, docs) => {
      captured.created.push(...docs);
      return docs.map(d => ({ id: `item-${Math.random().toString(36).slice(2)}`, ...d }));
    }
  };
}

function newResearchApp(over = {}) {
  const app = Object.create(CraftWorkshop.prototype);
  app.projects = [{
    id: "p1", title: "Моя находка", collapsed: false, mode: "research",
    crafterId: "crafter-1", categoryKey: "explosive",
    rarity: 0, quality: "common", toolKey: "common",
    gmMod: 0, assistants: 0, baseBank: 1, improve: false, monotony: false,
    diceMode: "normal", slowShift: false,
    researchKind: "blueprint", psychicResultType: PSYCHIC_RESULT_TYPES[0].key,
    studyTarget: "", findingCreated: false,
    vatKey: "common", bioTarget: "common", bioSkill: "medicae",
    bioImplant: "", bioAdvanced: false, bioLarge: false, bioHaem: false,
    bioCycle: 0, bioLog: [],
    skillChoices: {},
    project: { accumulated: 0, shifts: 0, fatigue: 0 },
    ...over
  }];
  app.render = () => {};
  return app;
}

let currentCrafter;
beforeEach(() => {
  resetCaptured();
  currentCrafter = researchCrafterActor();
  globalThis.game.actors = { get: id => (id === "crafter-1" ? currentCrafter : null) };
});

describe("_finishResearch: Чертёж/Истинное имя/Иное — создаётся предмет gear", () => {
  it("Банк заполнен сменой — создан предмет и запись в Журнале", async () => {
    const app = newResearchApp({ researchKind: "blueprint" });
    captured.nextRoll = 10; // низкий бросок vs высокий Предел → хватает Банка=1
    await app._rollShift("p1");

    expect(captured.created).toHaveLength(1);
    expect(captured.created[0].type).toBe("gear");
    expect(captured.created[0].name).toBe("Моя находка");

    const log = currentCrafter.getFlag("warhammer-dbc", RESEARCH_JOURNAL_FLAG);
    expect(log).toHaveLength(1);
    expect(log[0].kind).toBe("blueprint");
    expect(log[0].itemId).toBeTruthy();
    expect(app.projects[0].findingCreated).toBe(true);
    expect(captured.chat[0].content).toContain("Находка");
  });

  it("Повторная смена ПОСЛЕ готово — не создаёт второй предмет (findingCreated)", async () => {
    const app = newResearchApp({ researchKind: "blueprint" });
    captured.nextRoll = 10;
    await app._rollShift("p1");
    resetCaptured();
    currentCrafter.createEmbeddedDocuments = async (type, docs) => { throw new Error("не должно вызываться повторно"); };
    captured.nextRoll = 10;
    await app._rollShift("p1");

    expect(captured.created).toHaveLength(0);
  });
});

describe("_finishResearch: Психосила/ритуал/вязь", () => {
  it("по умолчанию — psychicPower, напоминание про трату Опыта в описании", async () => {
    const app = newResearchApp({ researchKind: "psychic" });
    captured.nextRoll = 10;
    await app._rollShift("p1");

    expect(captured.created[0].type).toBe("psychicPower");
    expect(captured.created[0].system.description).toMatch(/Опыт/);
  });

  it("выбран resultType=ritual — создаётся ritual с source «Исследование»", async () => {
    const app = newResearchApp({ researchKind: "psychic", psychicResultType: "ritual" });
    captured.nextRoll = 10;
    await app._rollShift("p1");

    expect(captured.created[0].type).toBe("ritual");
    expect(captured.created[0].system.source).toBe("Исследование");
  });
});

describe("_finishResearch: Изучение — без предмета", () => {
  it("НЕ создаёт предмет, записывает studyTarget в Журнал", async () => {
    const app = newResearchApp({ researchKind: "lore", studyTarget: "Scholastic Lore (Xenos)" });
    captured.nextRoll = 10;
    await app._rollShift("p1");

    expect(captured.created).toHaveLength(0);
    const log = currentCrafter.getFlag("warhammer-dbc", RESEARCH_JOURNAL_FLAG);
    expect(log).toHaveLength(1);
    expect(log[0].kind).toBe("lore");
    expect(log[0].studyTarget).toBe("Scholastic Lore (Xenos)");
    expect(log[0].itemId).toBeNull();
    expect(captured.chat[0].content).toContain("Scholastic Lore (Xenos)");
  });

  it("Навык теста ограничен Логикой (книга: «вместо создания знаний»)", async () => {
    const app = newResearchApp({ researchKind: "lore" });
    const R = app._resolve(app.projects[0]);
    expect(R.available.map(o => o.value)).toEqual(["skill:logic"]);
  });
});

describe("_finishResearch: смена до ГОТОВО не создаёт находку", () => {
  it("Банк не заполнен — нет предмета, Журнал пуст", async () => {
    const app = newResearchApp({ researchKind: "blueprint", baseBank: 1000 });
    captured.nextRoll = 90; // высокий бросок → провал/маленький прогресс
    await app._rollShift("p1");

    expect(captured.created).toHaveLength(0);
    expect(currentCrafter.getFlag("warhammer-dbc", RESEARCH_JOURNAL_FLAG)).toBeUndefined();
  });
});
