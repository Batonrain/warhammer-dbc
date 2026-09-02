// test/apps/character-wizard-v2.test.mjs
//
// CharacterWizard — последний (и самый крупный) файл эпика wdbc-x66t,
// переведённый на ApplicationV2. Рендера здесь нет — Foundry не запускается —
// проверяется договор класс/шаблон (общий describeV2Sheet, как у остальных
// девяти окон) и разводка кнопок шага/закрытия.

import { describe, it, expect, vi } from "vitest";
import "../support/foundry-stub.mjs";
import { listenerHtml } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { CharacterWizard } from "../../module/apps/character-wizard.mjs";
import { openCompendiumBrowser } from "../../module/apps/compendium-browser.mjs";

vi.mock("../../module/apps/compendium-browser.mjs", () => ({ openCompendiumBrowser: vi.fn() }));

describeV2Sheet(CharacterWizard, {
  sheet: "module/apps/character-wizard.mjs",
  template: "templates/apps/character-wizard.hbs"
});

// _onRender целиком (не только клик, который проверяет конкретный тест) вяжет
// ещё и activateFactionFieldListeners/activateAspirationListeners — обе ждут
// jQuery-корень (ещё не сняты с jQuery, wdbc-z0z). listenerHtml() — тот же
// приём, что и в actor-sheet-подобных тестах: настраивает глобальный `$` так,
// чтобы $(app.element) отдавал jQuery-совместимую обёртку.
function appLike(actor, nodes = {}) {
  const html = listenerHtml(nodes);
  const app = Object.create(CharacterWizard.prototype);
  app.actorId = actor?.id ?? null;
  app.stepIndex = 0;
  app.pendingMechChoices = [];
  app._confirmingArchetype = false;
  app._confirmingGear = false;
  app._gearDone = true;
  app.gearPicks = {};
  app._equipBonusPoints = 0;
  app.startLevelKey = "veteran";
  app.startExtraXp = 0; app.startExtraInf = 0; app.startExtraCor = 0;
  app._pendingHomeworldKey = null;
  app._pendingDivinationKey = null;
  Object.defineProperty(app, "actor", { get: () => actor });
  app.element = html[0];
  app.render = () => {};
  app._homeworldChoiceContext = () => null;
  app._divinationChoiceContext = () => null;
  return app;
}

// _confirmGear: дедуп текстового снаряжения Этапа 5 с тем, что уже выдано
// (обычно Механикой Расы/Архетипа на более раннем Этапе — wdbc-sai,
// doombc-gear-dual-path-bugs). _gearLayout переопределён напрямую на объекте
// (тот же приём, что appLike() уже делает для _homeworldChoiceContext) — не
// тянем resolveCreation/реальные Расы через актора, это отдельный контракт.
function gearApp({ actorItems = [], gearText, packs = new Map() }) {
  globalThis.game.packs = packs;
  const created = [];
  const actor = {
    id: "a1", name: "Тест", items: actorItems,
    createEmbeddedDocuments: async (type, docs) => { created.push(...docs); return docs; }
  };
  const app = appLike(actor);
  app._gearDone = false;
  app._gearLayout = () => ({ layout: [{ fixed: gearText }], choiceDefs: [], isAstartes: false });
  app._matchStandardSystemsCount = () => null;
  app._matchLegionCategoryGear = () => null;
  app._matchGearBudget = () => null;
  app._matchLeadingCount = () => 1;
  app._guessGearPack = () => "gear";
  app._grantStartingAmmo = async () => {};
  return { app, actor, created };
}

describe("_confirmGear: дедуп с уже выданным Механикой (wdbc-sai)", () => {
  it("предмет уже на акторе (билингвально), точного пак-совпадения нет — Обозреватель НЕ открывается, ничего не создаётся заново", async () => {
    openCompendiumBrowser.mockClear();
    const { app, created } = gearApp({
      actorItems: [{ name: "Custom Weapon / Особое Оружие" }],
      gearText: "Custom Weapon"
    });
    await CharacterWizard.prototype._confirmGear.call(app);
    expect(openCompendiumBrowser).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  it("предмета на акторе нет — Обозреватель открывается как раньше (ручной подбор)", async () => {
    openCompendiumBrowser.mockClear();
    openCompendiumBrowser.mockResolvedValueOnce(null); // игрок закрыл диалог — просто не создаём, поведение не проверяем
    const { app } = gearApp({ actorItems: [], gearText: "Custom Weapon" });
    await CharacterWizard.prototype._confirmGear.call(app);
    expect(openCompendiumBrowser).toHaveBeenCalledTimes(1);
  });
});

describe("_prepareContext", () => {
  it("сигнализирует отсутствие актора", async () => {
    const app = appLike(null);
    expect(await CharacterWizard.prototype._prepareContext.call(app, {})).toEqual({ missing: true });
  });
});

describe("_onRender: разводка кнопок шага", () => {
  it("data-wiz-action=wizBack откатывает шаг назад, пока не идёт применение Архетипа", () => {
    const app = appLike({ id: "a1" },
      { "[data-wiz-action='wizBack']": [{ dataset: {} }] });
    app.stepIndex = 2;
    const calls = [];
    app._goStep = i => calls.push(i);
    CharacterWizard.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-wiz-action='wizBack']:click"]();
    expect(calls).toEqual([1]);
  });

  it("data-wiz-action=wizBack не срабатывает во время применения Архетипа", () => {
    const app = appLike({ id: "a1" },
      { "[data-wiz-action='wizBack']": [{ dataset: {} }] });
    app._confirmingArchetype = true;
    const calls = [];
    app._goStep = i => calls.push(i);
    CharacterWizard.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-wiz-action='wizBack']:click"]();
    expect(calls).toEqual([]);
  });

  it("data-wiz-action=wizNext зовёт _onNext", () => {
    const app = appLike({ id: "a1" },
      { "[data-wiz-action='wizNext']": [{ dataset: {} }] });
    const calls = [];
    app._onNext = () => calls.push("next");
    CharacterWizard.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-wiz-action='wizNext']:click"]();
    expect(calls).toEqual(["next"]);
  });
});

describe("close()", () => {
  it("резолвит зависшие выборы Конструктора и снимает faction-хуки", async () => {
    globalThis.Hooks.off = vi.fn();
    const app = appLike({ id: "a1" });
    const resolved = [];
    app.pendingMechChoices = [
      { type: "spec", need: 2, resolve: v => resolved.push(v) },
      { type: "or", resolve: v => resolved.push(v) }
    ];
    app._factionHookIds = [{ hook: "createItem", id: 11 }, { hook: "deleteItem", id: 22 }];
    await CharacterWizard.prototype.close.call(app, {});
    expect(resolved).toEqual([[], null]);
    expect(app._isClosing).toBe(true);
    expect(app._factionHookIds).toEqual([]);
    expect(globalThis.Hooks.off).toHaveBeenCalledWith("createItem", 11);
    expect(globalThis.Hooks.off).toHaveBeenCalledWith("deleteItem", 22);
    delete globalThis.Hooks.off;
  });
});
