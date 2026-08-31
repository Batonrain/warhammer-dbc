// test/apps/veil-v2.test.mjs
//
// VeilMystic переведён с foundry.appv1.api.Application на ApplicationV2
// (wdbc-x66t.9, тот же паттерн, что у RigManager/CraftWorkshop — wdbc-x66t.1/6).
// Рендера в тестах нет — Foundry не запускается, — проверяется договор с
// шаблоном (общий describeV2Sheet) и разводка _onRender/_prepareContext.
// Переключение вкладок здесь РУЧНОЕ (свои data-tab/data-act, без декларативного
// V1 defaultOptions.tabs и без ApplicationV2 static TABS) — поэтому TABS-часть
// describeV2Sheet вырождается в пустую проверку, как задумано для этого файла.
// Расчётная математика ритуалов/варп-путешествия/Таро/Осквернения не тронута
// миграцией (сигнатуры не менялись) и здесь не дублируется — она живёт в
// module/apps/ritual-cast.mjs, module/constants/*.mjs и их собственных тестах.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { listenerRoot } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";
import { VeilMystic } from "../../module/apps/veil.mjs";
import { TAROT_SPREADS } from "../../module/constants/tarot.mjs";

describeV2Sheet(VeilMystic, {
  sheet: "module/apps/veil.mjs",
  template: "templates/apps/veil.hbs"
});

globalThis.game.actors = Object.assign([], { get: () => null });
globalThis.game.user.isGM = false;

// ── Заготовки внутреннего состояния (те же поля, что заводит конструктор
//    VeilMystic — _newRitual/_newJourney/_newDefile/_tarotSlots private,
//    не экспортированы, поэтому воспроизводим форму здесь). ──────────────
function newTarotSlots(spreadKey) {
  return (TAROT_SPREADS[spreadKey]?.positions || []).map(() => ({ cardN: null, reversed: false }));
}
function newState(over = {}) { return { tab: "veil", navId: "", godPicker: false, ...over }; }
function newRitual(over = {}) {
  return {
    ritualistId: "", itemId: "", name: "", type: "summon",
    skillValue: "", testChar: "", gmMod: -20,
    assistants: 0, assistSacrificed: 0, assistBonus: 10,
    summon: {}, curseFam: "close", curseSymp: {},
    numerology: {}, numMod: 0, psyker: false, psykerBonus: 0,
    aversionPerFail: 5, ...over
  };
}
function newJourney(over = {}) {
  return {
    shipId: "", gellar: "ok", occulum: "ok", warpEngineDmg: false, emergency: false,
    entryLoc: "mandeville", stability: "", stabilityMult: 1, psyMod: 0, beaconHidden: false,
    baseDuration: null, beaconMod: 0, days: 0,
    senseSkill: "", navSkill: "", helmSkill: "", ...over
  };
}
function newTarot(over = {}) {
  const spread = over.spread || "cross";
  return { subtab: "reading", spread, question: "", teomant: "", quirit: "", slots: newTarotSlots(spread), ...over };
}
function newDefile(over = {}) {
  return {
    weaponUuid: "", god: "undivided", demonName: "",
    demonFormula: "lesser", demonWb: 4, demonInf: 8, binding: 3,
    resonance: {}, ironwork: 0, gmMod: 0,
    ritualistId: "", skillValue: "",
    trueNameKnown: false, demonWilling: false, sacrificedAssist: 0, ...over
  };
}

/** Лист без рендера: прототип класса + подставной корень (listenerRoot). */
function appLike({ tab = "veil", isGM = false, nodes = {}, handlers = {} } = {}) {
  globalThis.game.user.isGM = isGM;
  const app = Object.create(VeilMystic.prototype);
  app.state = newState({ tab });
  app.ritual = newRitual();
  app.journey = newJourney();
  app.tarot = newTarot();
  app.defile = newDefile();
  app.element = listenerRoot(nodes, handlers);
  app.renders = 0;
  app.render = () => { app.renders += 1; };
  return app;
}

/** Узел для одиночного el.querySelector(...)?.addEventListener(...) — заглушка
 *  listenerRoot оборачивает в живой addEventListener только querySelectorAll,
 *  для querySelector нужно подсунуть готовый узел (тот же приём, что у
 *  test/apps/craft-workshop-v2.test.mjs для [data-act=add-project]). */
function qnode(handlers, selector, dataset = {}) {
  return { dataset, addEventListener: (evt, fn) => { handlers[`${selector}:${evt}`] = fn; } };
}

describe("_prepareContext", () => {
  it("отражает активную вкладку и не считает данные чужих вкладок", async () => {
    const app = appLike({ tab: "rituals" });
    const ctx = await VeilMystic.prototype._prepareContext.call(app, {});
    expect(ctx.tab).toBe("rituals");
    expect(ctx.isRituals).toBe(true);
    expect(ctx.isVeil).toBe(false);
    expect(ctx.tarot).toBeNull();
    expect(ctx.defile).toBeNull();
  });

  it("считает total/gauge для пустой Завесы по умолчанию (нет сцены → defaultVeil)", async () => {
    const app = appLike({ tab: "veil" });
    const ctx = await VeilMystic.prototype._prepareContext.call(app, {});
    expect(ctx.total).toBe(0);
    expect(ctx.gauge).toBe(50);
    expect(ctx.tier).toBe("stable");
  });

  it("собирает данные Таро только на вкладке «tarot»", async () => {
    const app = appLike({ tab: "tarot" });
    const ctx = await VeilMystic.prototype._prepareContext.call(app, {});
    expect(ctx.isTarot).toBe(true);
    expect(ctx.tarot).toBeTruthy();
    expect(ctx.tarot.spreadKey).toBe("cross");
    expect(ctx.tarot.slots.length).toBe(TAROT_SPREADS.cross.positions.length);
  });

  it("собирает данные Осквернения только на вкладке «defile»", async () => {
    const app = appLike({ tab: "defile" });
    const ctx = await VeilMystic.prototype._prepareContext.call(app, {});
    expect(ctx.isDefile).toBe(true);
    expect(ctx.defile).toBeTruthy();
    expect(ctx.defile.hasWeapon).toBe(false);
  });
});

describe("_onRender: вкладки и общие поля", () => {
  it("[data-tab] переключает вкладку и перерисовывает", () => {
    const app = appLike({ nodes: { "[data-tab]": [{ dataset: { tab: "rituals" } }] } });
    VeilMystic.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-tab]:click"]();
    expect(app.state.tab).toBe("rituals");
    expect(app.renders).toBe(1);
  });

  it("Ритуал: [name=ritGmMod] (change) парсит число в ritual.gmMod (доступно без ГМа)", () => {
    const handlers = {};
    const app = appLike({ handlers, nodes: { "[name=ritGmMod]": [qnode(handlers, "[name=ritGmMod]")] } });
    VeilMystic.prototype._onRender.call(app, {}, {});
    app.element.handlers["[name=ritGmMod]:change"]({ target: { value: "15" } });
    expect(app.ritual.gmMod).toBe(15);
    expect(app.renders).toBe(1);
  });

  it("нечисловой ввод в поле-число ритуала откатывается к 0, а не NaN/тексту", () => {
    const handlers = {};
    const app = appLike({ handlers, nodes: { "[name=ritAssist]": [qnode(handlers, "[name=ritAssist]")] } });
    VeilMystic.prototype._onRender.call(app, {}, {});
    app.element.handlers["[name=ritAssist]:change"]({ target: { value: "abc" } });
    expect(app.ritual.assistants).toBe(0);
  });
});

describe("_onRender: вкладка «Таро» (подвкладки/раскладка — своя ветка кода)", () => {
  it("[data-ttab] переключает subtab, когда активна вкладка tarot", () => {
    const app = appLike({ tab: "tarot", nodes: { "[data-ttab]": [{ dataset: { ttab: "guide" } }] } });
    VeilMystic.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-ttab]:click"]();
    expect(app.tarot.subtab).toBe("guide");
    expect(app.renders).toBe(1);
  });

  it("вне вкладки tarot [data-ttab] не получает обработчик вовсе", () => {
    const app = appLike({ tab: "veil", nodes: { "[data-ttab]": [{ dataset: { ttab: "guide" } }] } });
    VeilMystic.prototype._onRender.call(app, {}, {});
    expect(app.element.handlers["[data-ttab]:click"]).toBeUndefined();
  });
});

describe("_onRender: вкладка «Осквернение» (своя ветка кода)", () => {
  it("[name=defWb] клэмпит W.b демона минимум к 1", () => {
    const handlers = {};
    const app = appLike({
      tab: "defile", handlers,
      nodes: { "[name=defWb]": [qnode(handlers, "[name=defWb]")] }
    });
    VeilMystic.prototype._onRender.call(app, {}, {});
    app.element.handlers["[name=defWb]:change"]({ target: { value: "-3" } });
    expect(app.defile.demonWb).toBe(1);
    expect(app.renders).toBe(1);
  });

  it("вне вкладки defile [name=defWb] не получает обработчик вовсе", () => {
    const handlers = {};
    const app = appLike({
      tab: "veil", handlers,
      nodes: { "[name=defWb]": [qnode(handlers, "[name=defWb]")] }
    });
    VeilMystic.prototype._onRender.call(app, {}, {});
    expect(app.element.handlers["[name=defWb]:change"]).toBeUndefined();
  });
});

describe("_onRender: блок ГМа (Завеса/Ритуалы сцены — за `if (!isGM) return;`)", () => {
  it("не-ГМ не получает обработчик [data-act=godpick]", () => {
    const handlers = {};
    const app = appLike({
      isGM: false, handlers,
      nodes: { "[data-act=godpick]": [qnode(handlers, "[data-act=godpick]")] }
    });
    VeilMystic.prototype._onRender.call(app, {}, {});
    expect(app.element.handlers["[data-act=godpick]:click"]).toBeUndefined();
  });

  it("ГМ: клик [data-act=godpick] переключает открытость выбора Бога", () => {
    const handlers = {};
    const app = appLike({
      isGM: true, handlers,
      nodes: { "[data-act=godpick]": [qnode(handlers, "[data-act=godpick]")] }
    });
    VeilMystic.prototype._onRender.call(app, {}, {});
    app.element.handlers["[data-act=godpick]:click"]();
    expect(app.state.godPicker).toBe(true);
    expect(app.renders).toBe(1);
  });
});
