// test/apps/craft-workshop-crit-loss.test.mjs
//
// Потеря Успехов за Критический Провал (корбук, «Расширенные Тесты»: «Критические
// Провалы отнимают от 5 до 15 по решению ГМа») и Safety Precautions / Техника
// Безопасности: «не теряет Успехи из банка от Критических Провалов на тесты
// Крафта, а когда он ассистирует другим в тестах Крафта, те теряют только 1 Успех».

import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { CraftWorkshop, newCraftProject } from "../../module/apps/craft-workshop.mjs";
import { craftCritLoss, craftCritLossBase, hasSafetyPrecautions } from "../../module/rules/craft-advantage.mjs";

foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);

const safety = () => ({ type: "talent", name: "Safety Precautions / Техника Безопасности", system: {}, flags: {} });

function actor(id, items = []) {
  const a = {
    id, name: id === "crafter-1" ? "Крейн" : "Вокс", type: "character", items,
    system: {
      characteristics: { int: { total: 40, bonus: 4 } },
      skills: { techUse: { total: 50, rank: "trained" } },
      groupSkills: {}, fatigue: { value: 0 }, fate: { value: 2, max: 3 }
    },
    update: async () => {}
  };
  return a;
}

function newApp({ mode = "craft", accumulated = 20, critLoss = 10, assistants = 0, assistantId = "" } = {}) {
  const app = Object.create(CraftWorkshop.prototype);
  app.projects = [{
    id: "p1", title: "", collapsed: false, mode, crafterId: "crafter-1", categoryKey: "explosive",
    rarity: 0, quality: "common", toolKey: "common", gmMod: 0, assistants, assistantId, baseBank: 100,
    improve: false, monotony: false, diceMode: "normal", slowShift: false, researchKind: "blueprint",
    critLoss, vatKey: "common", bioTarget: "common", bioSkill: "medicae", bioImplant: "", bioAdvanced: false,
    bioLarge: false, bioHaem: false, bioCycle: 0, bioLog: [], skillChoices: {},
    project: { accumulated, shifts: 0, fatigue: 0 }
  }];
  app.render = () => {};
  return app;
}

let crafter, helper;
beforeEach(() => {
  resetCaptured();
  crafter = actor("crafter-1");
  helper = actor("helper-1");
  globalThis.game.actors = Object.assign([crafter, helper], { get: id => ({ "crafter-1": crafter, "helper-1": helper })[id] ?? null });
});

describe("craftCritLoss — чистое правило", () => {
  it("число ГМа зажато в 5–15, пусто → 10", () => {
    expect(craftCritLossBase(undefined)).toBe(10);
    expect(craftCritLossBase("")).toBe(10);
    expect(craftCritLossBase("abc")).toBe(10);
    expect(craftCritLossBase(3)).toBe(5);
    expect(craftCritLossBase(40)).toBe(15);
    expect(craftCritLossBase("12")).toBe(12);
  });

  it("без Критического Провала ничего не теряется", () => {
    expect(craftCritLoss({ critFailure: false, mode: "craft", configured: 10 }).loss).toBe(0);
  });

  it("Техника Безопасности: у крафтера — 0, у ассистента — 1; в Исследовании не действует", () => {
    const pro = actor("x", [safety()]);
    expect(hasSafetyPrecautions(pro)).toBe(true);
    expect(craftCritLoss({ critFailure: true, mode: "craft", configured: 12 }).loss).toBe(12);
    expect(craftCritLoss({ critFailure: true, mode: "craft", configured: 12, crafter: pro }).loss).toBe(0);
    expect(craftCritLoss({ critFailure: true, mode: "craft", configured: 12, assistantActor: pro }).loss).toBe(1);
    expect(craftCritLoss({ critFailure: true, mode: "research", configured: 12, crafter: pro }).loss).toBe(12);
  });
});

describe("Мастерская: смена с Критическим Провалом", () => {
  it("новый проект несёт поле потери с умолчанием 10", () => {
    globalThis.game.actors = Object.assign([], { get: () => null });
    expect(newCraftProject().critLoss).toBe(10);
  });

  it("Критический Провал снимает число ГМа из банка", async () => {
    const app = newApp({ accumulated: 20, critLoss: 7 });
    captured.nextRoll = 99;
    await app._rollShift("p1");
    expect(app.projects[0].project.accumulated).toBe(13);
    expect(captured.chat.at(-1).content).toContain("из банка потеряно <b>7</b>");
  });

  it("банк не уходит в минус", async () => {
    const app = newApp({ accumulated: 3, critLoss: 10 });
    captured.nextRoll = 99;
    await app._rollShift("p1");
    expect(app.projects[0].project.accumulated).toBe(0);
    expect(captured.chat.at(-1).content).toContain("в банке больше не было");
  });

  it("обычный провал Успехи не отнимает", async () => {
    const app = newApp({ accumulated: 20 });
    captured.nextRoll = 90;
    await app._rollShift("p1");
    expect(app.projects[0].project.accumulated).toBe(20);
  });

  it("Техника Безопасности крафтера — потери нет", async () => {
    crafter.items = [safety()];
    const app = newApp({ accumulated: 20 });
    captured.nextRoll = 99;
    await app._rollShift("p1");
    expect(app.projects[0].project.accumulated).toBe(20);
    expect(captured.chat.at(-1).content).toContain("Техника Безопасности — Успехи из банка не теряются");
  });

  it("Техника Безопасности у именованного ассистента — крафтер теряет 1 (ассистенты +1 Успех сверху)", async () => {
    helper.items = [safety()];
    const app = newApp({ accumulated: 20, assistants: 1, assistantId: "helper-1" });
    captured.nextRoll = 99;
    await app._rollShift("p1");
    expect(app.projects[0].project.accumulated).toBe(20);   // +1 ассистент −1 потеря
    expect(captured.chat.at(-1).content).toContain("Техника Безопасности ассистента (Вокс)");
  });
});
