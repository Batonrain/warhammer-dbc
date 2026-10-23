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
import { POLYMATH_CHAIN_MAX } from "../../module/constants/craft.mjs";

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
});

/** Крафтер, у которого update() реально пишет в system (по точечным ключам) —
 *  чтобы Усталость, начисленная через addFatigue, была видна следующей смене цепочки. */
function writableCrafter(over = {}) {
  const actor = crafterActor(over);
  actor.update = async fields => {
    for (const [path, value] of Object.entries(fields)) {
      const keys = path.replace(/^system\./, "").split(".");
      let node = actor.system;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
  };
  return actor;
}
const shiftCards = () => captured.chat.filter(c => String(c.content).includes("Смена №"));

// Polymath, крит в Мастерской (task-b6b8): «при Критическом Успехе — 1d5
// Усталости и сразу ещё один тест, по сути работа двух смен в одну».
describe("_rollShift: крит Полимата — 1d5 Усталости и ещё одна смена (task-b6b8)", () => {
  beforeEach(() => {
    currentCrafter = writableCrafter();
    currentCrafter.items = [{ type: "mutation", name: "Polymath / Полимат" }];
  });

  it("Критический Успех: +1d5 Усталости (через addFatigue) и вторая смена того же проекта", async () => {
    const app = newApp("crafter-1");
    app.projects[0].baseBank = 1000;
    captured.dice = [4, 3, 40]; // смена 1 (крит), 1d5 Усталости = 3, смена 2
    await app._rollShift("p1");

    expect(captured.rolls).toEqual(["1d100", "1d5", "1d100"]);
    expect(shiftCards()).toHaveLength(2);
    expect(app.projects[0].project.shifts).toBe(2);
    // 1 (смена 1) + 3 (1d5 Полимата) + 1 (смена 2) = 5
    expect(currentCrafter.system.fatigue.value).toBe(5);
    expect(shiftCards()[0].content).toContain("Полимат: Критический Успех");
    expect(shiftCards()[0].content).toContain("+3 Усталости");
    expect(shiftCards()[1].content).toContain("Дополнительная смена Полимата");
  });

  it("без крита (бросок 40) — одна смена, 1d5 не бросается", async () => {
    const app = newApp("crafter-1");
    captured.nextRoll = 40;
    await app._rollShift("p1");

    expect(captured.rolls).toEqual(["1d100"]);
    expect(shiftCards()).toHaveLength(1);
    expect(currentCrafter.system.fatigue.value).toBe(1);
    expect(shiftCards()[0].content).not.toContain("Дополнительная смена");
  });

  it("крит без Полимата — одна смена, как раньше", async () => {
    currentCrafter.items = [];
    const app = newApp("crafter-1");
    captured.nextRoll = 4;
    await app._rollShift("p1");

    expect(captured.rolls).toEqual(["1d100"]);
    expect(shiftCards()).toHaveLength(1);
    expect(currentCrafter.system.fatigue.value).toBe(1);
  });

  it("цепочка крит за критом упирается в лимит POLYMATH_CHAIN_MAX и это сказано в карточке", async () => {
    const app = newApp("crafter-1");
    app.projects[0].baseBank = 1000; // чтобы проект не закрылся раньше предела
    captured.nextRoll = 4; // любой бросок = 4: каждая смена — крит, 1d5 = 4
    await app._rollShift("p1");

    expect(shiftCards()).toHaveLength(POLYMATH_CHAIN_MAX);
    expect(app.projects[0].project.shifts).toBe(POLYMATH_CHAIN_MAX);
    const last = shiftCards().at(-1).content;
    expect(last).toContain("лимит цепочки");
    expect(shiftCards()[0].content).not.toContain("лимит цепочки");
    // 1d5 — за каждый крит, в том числе на последней смене цепочки (Усталость
    // идёт вместе с критом); не запускается только следующая смена.
    expect(captured.rolls.filter(f => f === "1d5")).toHaveLength(POLYMATH_CHAIN_MAX);
    expect(last).toContain("вручную");
  });

  it("проект закрылся этой же сменой — второй смены и 1d5 нет (работать больше не над чем)", async () => {
    const app = newApp("crafter-1");
    app.projects[0].baseBank = 1;
    captured.nextRoll = 4;
    await app._rollShift("p1");

    expect(captured.rolls).toEqual(["1d100"]);
    expect(shiftCards()).toHaveLength(1);
    expect(currentCrafter.system.fatigue.value).toBe(1);
    expect(shiftCards()[0].content).toContain("проект готов");
  });

  it("крафтер потерял сознание от Усталости — цепочка не продолжается", async () => {
    currentCrafter = writableCrafter({
      characteristics: { int: { total: 40 }, t: { bonus: 3 }, wp: { bonus: 3 } },
      fatigue: { value: 4 } // порог 6: Усталость смены 1 даёт 5, 1d5 (=4) — обморок
    });
    currentCrafter.items = [{ type: "mutation", name: "Polymath / Полимат" }];
    const app = newApp("crafter-1");
    app.projects[0].baseBank = 1000;
    captured.dice = [4, 4];
    await app._rollShift("p1");

    expect(shiftCards()).toHaveLength(1);
    expect(shiftCards()[0].content).toContain("без сознания");
    expect(app.projects[0].project.shifts).toBe(1);
  });
});

// Workaholic / Трудоголик (3-3a64): штраф монотонности −30 с владельца снят.
describe("_rollShift: Трудоголик снимает штраф монотонности", () => {
  const limitOf = () => Number(captured.chat.at(-1).content.match(/vs Предел (-?\d+)/)[1]);

  it("монотонная работа без Таланта: Предел −30, в карточке пометка", async () => {
    const plain = newApp("crafter-1");
    captured.nextRoll = 40;
    await plain._rollShift("p1");
    const baseLimit = limitOf();

    resetCaptured();
    const app = newApp("crafter-1");
    app.projects[0].monotony = true;
    captured.nextRoll = 40;
    await app._rollShift("p1");
    expect(limitOf()).toBe(baseLimit - 30);
    expect(captured.chat.at(-1).content).toContain("монотонность −30");
  });

  it("с Талантом: Предел как без монотонности, в карточке сказано, почему штрафа нет", async () => {
    const plain = newApp("crafter-1");
    captured.nextRoll = 40;
    await plain._rollShift("p1");
    const baseLimit = limitOf();

    resetCaptured();
    currentCrafter.items = [{ type: "talent", name: "Workaholic / Трудоголик" }];
    const app = newApp("crafter-1");
    app.projects[0].monotony = true;
    captured.nextRoll = 40;
    await app._rollShift("p1");
    expect(limitOf()).toBe(baseLimit);
    expect(captured.chat.at(-1).content).not.toContain("монотонность −30");
    expect(captured.chat.at(-1).content).toContain("Трудоголик: штраф за монотонность не применяется");
  });

  it("Талант есть, но галочки монотонности нет — пометки нет", async () => {
    currentCrafter.items = [{ type: "talent", name: "Workaholic / Трудоголик" }];
    const app = newApp("crafter-1");
    captured.nextRoll = 40;
    await app._rollShift("p1");
    expect(captured.chat.at(-1).content).not.toContain("Трудоголик");
  });
});

// Fabricator / Фабрикатор (3-3a64): бонусы от инструментов удваиваются.
describe("Фабрикатор удваивает бонус инструментов", () => {
  it("_resolve: Качественные инструменты +10 → +20 у владельца, у остальных +10", () => {
    const app = newApp("crafter-1");
    app.projects[0].toolKey = "good";
    expect(app._resolve(app.projects[0]).mods.toolMod).toBe(10);

    currentCrafter.items = [{ type: "talent", name: "Fabricator / Фабрикатор" }];
    expect(app._resolve(app.projects[0]).mods.toolMod).toBe(20);
  });

  it("штраф за плохие инструменты не удваивается", () => {
    currentCrafter.items = [{ type: "talent", name: "Fabricator / Фабрикатор" }];
    const app = newApp("crafter-1");
    app.projects[0].toolKey = "primit"; // −10
    expect(app._resolve(app.projects[0]).mods.toolMod).toBe(-10);
  });

  it("Исследование: инструменты книга для Крафта — не удваиваются", () => {
    currentCrafter.items = [{ type: "talent", name: "Fabricator / Фабрикатор" }];
    const app = newApp("crafter-1");
    app.projects[0].toolKey = "good";
    app.projects[0].mode = "research";
    expect(app._resolve(app.projects[0]).mods.toolMod).toBe(10);
  });

  it("смена: Предел выше ровно на бонус инструментов (+20 мастерский набор → +40)", async () => {
    const run = async () => {
      resetCaptured();
      const app = newApp("crafter-1");
      app.projects[0].toolKey = "best"; // +20
      captured.nextRoll = 40;
      await app._rollShift("p1");
      return Number(captured.chat.at(-1).content.match(/vs Предел (-?\d+)/)[1]);
    };
    const base = await run();
    currentCrafter.items = [{ type: "talent", name: "Fabricator / Фабрикатор" }];
    expect(await run()).toBe(base + 20);
  });
});

// Master Engineseer / Мастер-Технопровидец (3-cc96 п.11, часть «+10 Tech-Use на Крафт»).
describe("_rollShift: Мастер-Технопровидец +10 к Tech-Use на Крафт", () => {
  const limitOf = () => Number(captured.chat.at(-1).content.match(/vs Предел (-?\d+)/)[1]);

  it("Tech-Use ведущий: +10 к Пределу и строка в карточке", async () => {
    const plain = newApp("crafter-1");
    captured.nextRoll = 40;
    await plain._rollShift("p1");
    const baseLimit = limitOf();

    resetCaptured();
    currentCrafter.items = [{ type: "talent", name: "Master Engineseer / Мастер-Технопровидец" }];
    const app = newApp("crafter-1");
    captured.nextRoll = 40;
    await app._rollShift("p1");
    expect(limitOf()).toBe(baseLimit + 10);
    expect(captured.chat.at(-1).content).toContain("Мастер-Технопровидец: +10 к тесту");
  });

  it("ведущий Навык — Ремесло (Tech-Use лишь вторичный): бонуса нет", async () => {
    currentCrafter = crafterActor({
      groupSkills: { trade: [{ specialty: "Armourer", total: 70, rank: "trained", char: "ag" }] }
    });
    currentCrafter.items = [{ type: "talent", name: "Master Engineseer / Мастер-Технопровидец" }];
    const app = newApp("crafter-1", { categoryKey: "powerArmor" }); // Armourer + Tech-Use
    captured.nextRoll = 40;
    await app._rollShift("p1");
    expect(captured.chat.at(-1).content).not.toContain("Мастер-Технопровидец");
  });

  it("Исследование: бонуса нет (книга — Крафт и ремонт)", async () => {
    currentCrafter.items = [{ type: "talent", name: "Master Engineseer / Мастер-Технопровидец" }];
    const app = newApp("crafter-1");
    app.projects[0].mode = "research";
    app.projects[0].skillChoices = { 0: "skill:techUse" };
    captured.nextRoll = 40;
    await app._rollShift("p1");
    expect(captured.chat.at(-1).content).not.toContain("Мастер-Технопровидец");
  });
});

// Лаборатория Гемункула (wdbc-6nl9): +60 безусловно на тест Крафта/
// Исследования — благо стадии 0 Элитного архетипа Гемункул, не Талант/Мутация.
describe("_rollShift: Лаборатория Гемункула (wdbc-6nl9)", () => {
  it("Гемункул — +60 к тесту, отдельная строка в карточке", async () => {
    currentCrafter.system.eliteArchetype = "Haemonculus / Гемункул";
    const app = newApp("crafter-1");
    captured.nextRoll = 40;
    await app._rollShift("p1");

    expect(captured.chat[0].content).toContain("Лаборатория Гемункула: +60 к тесту");
  });

  it("не Гемункул — строки нет, Предел ниже на 60", async () => {
    const withoutBonus = newApp("crafter-1");
    captured.nextRoll = 40;
    await withoutBonus._rollShift("p1");

    expect(captured.chat[0].content).not.toContain("Лаборатория Гемункула");
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
