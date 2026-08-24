// test/apps/craft-workshop.test.mjs
//
// Раскатка «Кубика»/Крита на Крафт (см. память doombc-test-kind-rollout):
// только Кубик+Крит на _rollShift — Сложность не добавлена (у Крафта уже
// есть «Модификатор ГМа»), Вид теста не добавлен (свой книжный
// Комбинированный/Расширенный). CraftWorkshop — постоянное окно
// (foundry.appv1.api.Application), не диалог: тест зовёт _rollShift
// напрямую на подставном экземпляре, без рендера формы.

import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { CraftWorkshop } from "../../module/apps/craft-workshop.mjs";

function crafterActor(over = {}) {
  return {
    id: "crafter-1", name: "Крейн",
    system: {
      characteristics: { int: { total: 40 } },
      skills: { techUse: { total: 50, rank: "trained" } },
      groupSkills: {},
      fatigue: { value: 0 },
      ...over
    },
    update: async () => {}
  };
}

function newApp(crafterId) {
  const app = Object.create(CraftWorkshop.prototype);
  app.projects = [{
    id: "p1", title: "", collapsed: false, mode: "craft",
    crafterId, categoryKey: "explosive", // S("techUse") — простая одиночная требуемая проверка
    rarity: 0, quality: "common", toolKey: "common",
    gmMod: 0, assistants: 0, baseBank: 20, improve: false, monotony: false,
    diceMode: "normal",
    researchKind: "blueprint",
    vatKey: "common", bioTarget: "common", bioSkill: "medicae",
    bioImplant: "", bioAdvanced: false, bioLarge: false, bioHaem: false,
    bioCycle: 0, bioLog: [],
    skillChoices: {},
    project: { accumulated: 0, shifts: 0, fatigue: 0 }
  }];
  app.render = () => {};
  return app;
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.actors = { get: id => (id === "crafter-1" ? crafterActor() : null) };
});

describe("_rollShift: Кубик и Крит", () => {
  it("Обычный: один бросок, без Кубик-строки", async () => {
    const app = newApp("crafter-1");
    captured.nextRoll = 40;
    await app._rollShift("p1");

    expect(captured.rolls).toEqual(["1d100"]);
    expect(captured.chat[0].content).not.toContain("отброшено");
  });

  it("Преимущество: два броска, отброшенный худший назван", async () => {
    const app = newApp("crafter-1");
    app.projects[0].diceMode = "advantage";
    captured.dice = [80, 20];
    await app._rollShift("p1");

    expect(captured.rolls).toEqual(["1d100", "1d100"]);
    expect(captured.chat[0].content).toContain("Преимущество: отброшено 80");
    expect(captured.chat[0].content).toContain("<b>20</b>");
  });

  it("Помеха: берётся худший бросок", async () => {
    const app = newApp("crafter-1");
    app.projects[0].diceMode = "disadvantage";
    captured.dice = [80, 20];
    await app._rollShift("p1");

    expect(captured.chat[0].content).toContain("Помеха: отброшено 20");
    expect(captured.chat[0].content).toContain("vs Предел");
  });

  it("натуральный 1-5 — Критический Успех в карточке смены", async () => {
    const app = newApp("crafter-1");
    captured.nextRoll = 4;
    await app._rollShift("p1");

    expect(captured.chat[0].content).toContain("Критический Успех");
  });

  it("натуральный 96-100 — Критический Провал", async () => {
    const app = newApp("crafter-1");
    captured.nextRoll = 97;
    await app._rollShift("p1");

    expect(captured.chat[0].content).toContain("Критический Провал");
  });

  it("Успех прибавляет к банку, крафтер получает +1 Усталости", async () => {
    const app = newApp("crafter-1");
    captured.nextRoll = 10;
    await app._rollShift("p1");

    expect(app.projects[0].project.accumulated).toBeGreaterThan(0);
    expect(app.projects[0].project.shifts).toBe(1);
  });
});
