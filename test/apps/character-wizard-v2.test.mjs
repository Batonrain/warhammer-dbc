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
