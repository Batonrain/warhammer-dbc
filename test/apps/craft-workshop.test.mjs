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
    items: [],
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

function newApp(crafterId, { categoryKey = "explosive", slowShift = false } = {}) {
  const app = Object.create(CraftWorkshop.prototype);
  app.projects = [{
    id: "p1", title: "", collapsed: false, mode: "craft",
    crafterId, categoryKey, // S("techUse") — простая одиночная требуемая проверка
    rarity: 0, quality: "common", toolKey: "common",
    gmMod: 0, assistants: 0, baseBank: 20, improve: false, monotony: false,
    diceMode: "normal", slowShift,
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

let currentCrafter, currentAssistant;
beforeEach(() => {
  resetCaptured();
  currentCrafter = crafterActor();
  currentAssistant = { id: "assistant-1", name: "Помощник", items: [] };
  globalThis.game.actors = {
    get: id => (id === "crafter-1" ? currentCrafter : id === "assistant-1" ? currentAssistant : null)
  };
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

// wdbc-u0by: Cyberpreacher (пассивно, категория "bionics") и Slow Shift
// (галочка → +30 и Преимущество) — поверх того же Кубика смены.
describe("_rollShift: Преимущество от Талантов (wdbc-u0by)", () => {
  it("Cyberpreacher + категория bionics — Преимущество применяется сам по себе, без ручного выбора", async () => {
    currentCrafter.items = [{ type: "talent", name: "Cyberpreacher / Киберпроповедник" }];
    const app = newApp("crafter-1", { categoryKey: "bionics" });
    captured.dice = [80, 20];
    await app._rollShift("p1");

    expect(captured.rolls).toEqual(["1d100", "1d100"]);
    expect(captured.chat[0].content).toContain("Преимущество (Талант): отброшено 80");
  });

  it("Cyberpreacher есть, но категория другая — ручной Кубик (Обычный) не подменяется", async () => {
    currentCrafter.items = [{ type: "talent", name: "Cyberpreacher / Киберпроповедник" }];
    const app = newApp("crafter-1", { categoryKey: "explosive" });
    captured.nextRoll = 40;
    await app._rollShift("p1");

    expect(captured.rolls).toEqual(["1d100"]);
  });

  it("Slow Shift выбран и Талант есть — Преимущество (два броска)", async () => {
    currentCrafter.items = [{ type: "talent", name: "Slow Shift / Медленная Смена" }];
    const app = newApp("crafter-1", { slowShift: true });
    captured.dice = [80, 20];
    await app._rollShift("p1");

    expect(captured.rolls).toEqual(["1d100", "1d100"]);
    expect(captured.chat[0].content).toContain("Преимущество (Талант): отброшено 80");
  });

  it("Slow Shift выбран, но Таланта нет — ничего не подменяется (защита от несогласованных данных)", async () => {
    const app = newApp("crafter-1", { slowShift: true });
    captured.nextRoll = 40;
    await app._rollShift("p1");

    expect(captured.rolls).toEqual(["1d100"]);
  });

  it("Подмастерье (wdbc-1rno): именованный ассистент РЕАЛЬНО владеет Талантом — Преимущество", async () => {
    currentAssistant.items = [{ type: "talent", name: "Journeyman / Подмастерье" }];
    const app = newApp("crafter-1");
    app.projects[0].assistants = 1;
    app.projects[0].assistantId = "assistant-1";
    captured.dice = [80, 20];
    await app._rollShift("p1");

    expect(captured.rolls).toEqual(["1d100", "1d100"]);
    expect(captured.chat[0].content).toContain("Преимущество (Талант): отброшено 80");
  });

  it("Подмастерье: именованный ассистент указан, но Таланта у него НЕТ — не применяется (раньше было невозможно проверить)", async () => {
    const app = newApp("crafter-1");
    app.projects[0].assistants = 1;
    app.projects[0].assistantId = "assistant-1"; // currentAssistant.items пуст
    captured.nextRoll = 40;
    await app._rollShift("p1");

    expect(captured.rolls).toEqual(["1d100"]);
  });

  it("Подмастерье: Талант есть, но ассистент не указан (assistantId пуст) — не применяется", async () => {
    const app = newApp("crafter-1");
    app.projects[0].assistants = 1;
    captured.nextRoll = 40;
    await app._rollShift("p1");

    expect(captured.rolls).toEqual(["1d100"]);
  });
});

// Dark Muse / Тёмная Муза (wdbc-1rno): именованный ассистент даёт +30
// (в Мастерской — всегда тест Крафта/Исследования) вместо обычных +10 за
// себя, остальные ассистенты (если есть) — как обычно.
describe("_rollShift: Тёмная Муза (wdbc-1rno)", () => {
  it("именованный ассистент владеет Даром — +30 вместо +10 за себя", async () => {
    currentAssistant.items = [{ type: "mutation", name: "Dark Muse / Тёмная Муза" }];
    const app = newApp("crafter-1");
    app.projects[0].assistants = 1;
    app.projects[0].assistantId = "assistant-1";
    captured.nextRoll = 40;
    await app._rollShift("p1");

    expect(captured.chat[0].content).toContain("Ассистенты (1): +30 к тесту, +1 успеха (вкл. Тёмную Музу +30)");
  });

  it("2 ассистента, один из них Тёмная Муза — 10 (обычный) + 30 (Муза) = 40", async () => {
    currentAssistant.items = [{ type: "mutation", name: "Dark Muse / Тёмная Муза" }];
    const app = newApp("crafter-1");
    app.projects[0].assistants = 2;
    app.projects[0].assistantId = "assistant-1";
    captured.nextRoll = 40;
    await app._rollShift("p1");

    expect(captured.chat[0].content).toContain("Ассистенты (2): +40 к тесту, +2 успеха (вкл. Тёмную Музу +30)");
  });

  it("Талант с тем же именем на именованном ассистенте — НЕ Дар, не применяется", async () => {
    currentAssistant.items = [{ type: "talent", name: "Dark Muse / Тёмная Муза" }];
    const app = newApp("crafter-1");
    app.projects[0].assistants = 1;
    app.projects[0].assistantId = "assistant-1";
    captured.nextRoll = 40;
    await app._rollShift("p1");

    expect(captured.chat[0].content).toContain("Ассистенты (1): +10 к тесту, +1 успеха</div>");
  });

  it("Дар есть, но assistants=0 — бонус не применяется (нечего заменять)", async () => {
    currentAssistant.items = [{ type: "mutation", name: "Dark Muse / Тёмная Муза" }];
    const app = newApp("crafter-1");
    app.projects[0].assistantId = "assistant-1";
    captured.nextRoll = 40;
    await app._rollShift("p1");

    expect(captured.chat[0].content).not.toContain("Тёмную Музу");
  });
});

// Polymath / Полимат (wdbc-1rno): +10 безусловно на тест Крафта/Исследования,
// в отличие от Cyberpreacher — не завязан на категорию проекта.
describe("_rollShift: Полимат (wdbc-1rno)", () => {
  it("Мутация есть — +10 к тесту, отдельная строка в карточке", async () => {
    currentCrafter.items = [{ type: "mutation", name: "Polymath / Полимат" }];
    const app = newApp("crafter-1");
    captured.nextRoll = 40;
    await app._rollShift("p1");

    expect(captured.chat[0].content).toContain("Полимат: +10 к тесту");
  });

  it("нет Мутации — строки нет, Предел ниже на 10", async () => {
    const withoutBonus = newApp("crafter-1");
    captured.nextRoll = 40;
    await withoutBonus._rollShift("p1");

    expect(captured.chat[0].content).not.toContain("Полимат");
  });

  it("Талант с тем же именем НЕ считается — только Мутация", async () => {
    currentCrafter.items = [{ type: "talent", name: "Polymath / Полимат" }];
    const app = newApp("crafter-1");
    captured.nextRoll = 40;
    await app._rollShift("p1");

    expect(captured.chat[0].content).not.toContain("Полимат");
  });

  it("сдвигает Предел теста ровно на +10", async () => {
    const base = newApp("crafter-1");
    captured.nextRoll = 40;
    await base._rollShift("p1");
    const baseLimit = Number(captured.chat[0].content.match(/vs Предел (-?\d+)/)[1]);

    resetCaptured();
    currentCrafter.items = [{ type: "mutation", name: "Polymath / Полимат" }];
    const boosted = newApp("crafter-1");
    captured.nextRoll = 40;
    await boosted._rollShift("p1");
    const boostedLimit = Number(captured.chat[0].content.match(/vs Предел (-?\d+)/)[1]);

    expect(boostedLimit).toBe(baseLimit + 10);
  });
});
