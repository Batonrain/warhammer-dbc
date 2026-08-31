// test/apps/craft-workshop-v2.test.mjs
//
// CraftWorkshop переведён с foundry.appv1.api.Application на ApplicationV2
// (wdbc-x66t.6, тот же паттерн, что и RigManager — wdbc-x66t.1). Рендера в
// тестах нет — Foundry не запускается, — проверяется договор с шаблоном
// (общий describeV2Sheet) и разводка _onRender/_prepareContext. Расчётная
// логика (_rollShift, _rollCycle) уже покрыта test/apps/craft-workshop.test.mjs
// и здесь не дублируется — сигнатуры этих методов миграция не меняла.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { listenerRoot } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { CraftWorkshop } from "../../module/apps/craft-workshop.mjs";

describeV2Sheet(CraftWorkshop, {
  sheet: "module/apps/craft-workshop.mjs",
  template: "templates/apps/craft-workshop.hbs"
});

function newProject(over = {}) {
  return {
    id: "p1", title: "", collapsed: false, mode: "craft",
    crafterId: "", categoryKey: "explosive",
    rarity: 0, quality: "common", toolKey: "common",
    gmMod: 0, assistants: 0, baseBank: 20, improve: false, monotony: false,
    diceMode: "normal", researchKind: "blueprint",
    vatKey: "common", bioTarget: "common", bioSkill: "medicae",
    bioImplant: "", bioAdvanced: false, bioLarge: false, bioHaem: false,
    bioCycle: 0, bioLog: [],
    skillChoices: {},
    project: { accumulated: 0, shifts: 0, fatigue: 0 },
    ...over
  };
}

/** Лист без рендера: прототип класса + подставной корень (listenerRoot).
 *  «+ добавить проект» — единственная кнопка на `querySelector` (не -All):
 *  в отличие от querySelectorAll, заглушка отдаёт сюда СЫРОЙ узел без обвязки
 *  addEventListener — подставляем свой узел, пишущий прямо в handlers. */
function appLike(projects = [newProject()]) {
  const handlers = {};
  const addProjectNode = { dataset: {}, addEventListener: (evt, fn) => { handlers[`[data-act=add-project]:${evt}`] = fn; } };
  const app = Object.create(CraftWorkshop.prototype);
  app.projects = projects;
  app.element = listenerRoot({ "[data-act=add-project]": [addProjectNode] }, handlers);
  app.renders = 0;
  app.render = () => { app.renders += 1; };
  return app;
}

/** Событие для обработчиков `on(sel, evt, fn)`: pid лежит на «карточке» проекта,
 *  которую находит closest("[data-pid]") от currentTarget — как в реальной разметке. */
function evt({ pid = "p1", value, checked } = {}) {
  return {
    currentTarget: { closest: sel => (sel === "[data-pid]" ? { dataset: { pid } } : null) },
    target: { value, checked }
  };
}

globalThis.game.actors = Object.assign([], { get: () => null });
globalThis.game.user.isGM = false;

describe("_prepareContext", () => {
  it("собирает базовый контекст: проекты, иконки, флаг ГМ", async () => {
    const app = appLike();
    const ctx = await CraftWorkshop.prototype._prepareContext.call(app, {});
    expect(ctx.projects).toHaveLength(1);
    expect(ctx.projects[0].id).toBe("p1");
    expect(ctx.multiple).toBe(false);
    expect(typeof ctx.isGM).toBe("boolean");
    expect(ctx.icoCraft).toBeTruthy();
  });

  it("multiple становится true при нескольких проектах", async () => {
    const app = appLike([newProject(), newProject({ id: "p2" })]);
    const ctx = await CraftWorkshop.prototype._prepareContext.call(app, {});
    expect(ctx.multiple).toBe(true);
    expect(ctx.projects).toHaveLength(2);
  });

  it("машины: Банк умножается на (Размер+1) сам, без ручного счёта (wdbc-5il7)", async () => {
    const app = appLike([newProject({
      categoryKey: "wheeled", rarity: 0, quality: "common", baseBank: null, machineSize: 2
    })]);
    const ctx = await CraftWorkshop.prototype._prepareContext.call(app, {});
    const p = ctx.projects[0];
    expect(p.machineNote).toBe(true);
    expect(p.baseBankVal).toBe(40); // таблица категории "wheeled", редкость 0
    expect(p.bank).toBe(120);       // 40 × (2 + 1)
  });

  it("машины: Размер 0 — Банк не меняется (×1)", async () => {
    const app = appLike([newProject({ categoryKey: "wheeled", rarity: 0, baseBank: null, machineSize: 0 })]);
    const ctx = await CraftWorkshop.prototype._prepareContext.call(app, {});
    expect(ctx.projects[0].bank).toBe(40);
  });

  it("не-машина: machineSize игнорируется, Банк как обычно", async () => {
    const app = appLike([newProject({ categoryKey: "explosive", baseBank: 20, machineSize: 5 })]);
    const ctx = await CraftWorkshop.prototype._prepareContext.call(app, {});
    expect(ctx.projects[0].machineNote).toBe(false);
    expect(ctx.projects[0].bank).toBe(20);
  });
});

describe("_onRender: разводка кнопок и полей", () => {
  it("[data-act=add-project] добавляет проект и перерисовывает", () => {
    const app = appLike();
    CraftWorkshop.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-act=add-project]:click"]();
    expect(app.projects).toHaveLength(2);
    expect(app.renders).toBe(1);
  });

  it("[name=ptitle] (change) пишет название в нужный проект по pid из closest", () => {
    const app = appLike();
    CraftWorkshop.prototype._onRender.call(app, {}, {});
    app.element.handlers["[name=ptitle]:change"](evt({ pid: "p1", value: "Болтер Марка VII" }));
    expect(app.projects[0].title).toBe("Болтер Марка VII");
    expect(app.renders).toBe(1);
  });

  it("[data-act=toggle] инвертирует collapsed нужного проекта", () => {
    const app = appLike();
    CraftWorkshop.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-act=toggle]:click"](evt({ pid: "p1" }));
    expect(app.projects[0].collapsed).toBe(true);
    app.element.handlers["[data-act=toggle]:click"](evt({ pid: "p1" }));
    expect(app.projects[0].collapsed).toBe(false);
  });

  it("[data-act=shift] зовёт _rollShift с pid проекта, не render напрямую", () => {
    const app = appLike();
    const calls = [];
    app._rollShift = pid => calls.push(pid);
    CraftWorkshop.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-act=shift]:click"](evt({ pid: "p1" }));
    expect(calls).toEqual(["p1"]);
  });

  it("[name=rarity] (change) приводит значение к числу и сбрасывает ручной баланс банка", () => {
    const app = appLike([newProject({ baseBank: 42 })]);
    CraftWorkshop.prototype._onRender.call(app, {}, {});
    app.element.handlers["[name=rarity]:change"](evt({ pid: "p1", value: "3" }));
    expect(app.projects[0].rarity).toBe(3);
    expect(app.projects[0].baseBank).toBeNull();
  });

  it("несуществующий pid (проект уже удалён из другой карточки) не падает и не рендерит", () => {
    const app = appLike();
    CraftWorkshop.prototype._onRender.call(app, {}, {});
    app.element.handlers["[name=ptitle]:change"](evt({ pid: "does-not-exist", value: "x" }));
    expect(app.renders).toBe(0);
    expect(app.projects[0].title).toBe("");
  });
});
