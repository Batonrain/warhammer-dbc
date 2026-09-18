// test/combat/rig-steal.test.mjs
//
// «Забрать предмет с чужой разгрузки» (стр. 27): магнитный замок сопротивляется
// Борьбе/телекинезу/магнитному притяжению — только Боевой контакт + тест S−30;
// карман/кобура/рюкзак — «ситуация противоположная», без теста, но нужен либо
// Боевой контакт, либо дисциплина Телекинез. wdbc-x1nz.2.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { hasTelekinesis, inMeleeContact, stealableItems, useStealFromRig, initRigStealHud }
  from "../../module/combat/rig-steal.mjs";

function token({ x = 0, y = 0, width = 1, height = 1 } = {}) {
  return { document: { x, y, width, height, rotation: 0 } };
}

function gearItem(id, name, overrides = {}) {
  return {
    id, name, type: "gear", system: { weight: 0, equipped: false, ...overrides },
    toObject: () => ({ id, name, type: "gear", system: { weight: 0, equipped: false, ...overrides } }),
    delete: async () => { deletedIds.push(id); }
  };
}

function beltItem(id = "belt1") {
  return {
    id, name: "Belt / Ремень", type: "gear",
    system: {
      isRig: true, weight: 1,
      rig: {
        comfort: "normal", backSlot: false,
        slots: [{ size: "1x1", count: 1, note: "спереди" }],
        magLocks: [{ size: "4x1", count: 1, note: "бедро" }]
      }
    },
    flags: {}
  };
}

let deletedIds;

function victimActor(items, stow = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return {
    id: "victim-1", name: "Жертва", type: "character", items: list,
    getFlag: (_scope, key) => (key === "stowage" ? stow : undefined)
  };
}

function thiefActor({ ap = 2, sb = 40, psychicPowers = [] } = {}) {
  const created = [];
  const items = [...psychicPowers];
  return {
    id: "thief-1", name: "Вор", type: "character", items,
    system: { actionPoints: { value: ap, max: 2 }, characteristics: { s: { total: sb, bonus: 0 } } },
    update: async data => { Object.assign(this?.system ?? {}, data); },
    createEmbeddedDocuments: async (_type, docs) => { created.push(...docs); return docs; },
    _created: created
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { grid: { size: 100 } };
  globalThis.game.time = { worldTime: 0 };
  deletedIds = [];
});

describe("hasTelekinesis", () => {
  it("нет психосил — false", () => {
    expect(hasTelekinesis({ items: [] })).toBe(false);
  });
  it("есть сила другой дисциплины — false", () => {
    expect(hasTelekinesis({ items: [{ type: "psychicPower", system: { discipline: "pyromancy" } }] })).toBe(false);
  });
  it("есть сила дисциплины telekinesis — true", () => {
    expect(hasTelekinesis({ items: [{ type: "psychicPower", system: { discipline: "telekinesis" } }] })).toBe(true);
  });
});

describe("inMeleeContact", () => {
  it("вплотную (0 клеток) — контакт", () => {
    expect(inMeleeContact(token({ x: 0, y: 0 }), token({ x: 0, y: 0 }))).toBe(true);
  });
  it("1 клетка (100px = 1м) — контакт (порог 1.5)", () => {
    expect(inMeleeContact(token({ x: 0, y: 0 }), token({ x: 100, y: 0 }))).toBe(true);
  });
  it("2 клетки (200px = 2м) — вне контакта", () => {
    expect(inMeleeContact(token({ x: 0, y: 0 }), token({ x: 200, y: 0 }))).toBe(false);
  });
});

describe("stealableItems", () => {
  it("предмет на магнитном замке помечен magLocked:true", () => {
    const belt = beltItem();
    const knife = gearItem("knife1", "Нож");
    const v = victimActor([belt, knife], { knife1: "belt1:m:0:0" });
    const items = stealableItems(v);
    expect(items.find(i => i.id === "knife1")).toEqual({ id: "knife1", name: "Нож", magLocked: true });
  });

  it("предмет в обычном слоте (не замок) — magLocked:false", () => {
    const belt = beltItem();
    const knife = gearItem("knife1", "Нож");
    const v = victimActor([belt, knife], { knife1: "belt1:s:0:0" });
    const items = stealableItems(v);
    expect(items.find(i => i.id === "knife1")).toEqual({ id: "knife1", name: "Нож", magLocked: false });
  });

  it("не размещённый предмет тоже доступен, magLocked:false", () => {
    const belt = beltItem();
    const loose = gearItem("loose1", "Мелочь");
    const v = victimActor([belt, loose], {});
    const items = stealableItems(v);
    expect(items.find(i => i.id === "loose1")).toEqual({ id: "loose1", name: "Мелочь", magLocked: false });
  });

  it("предмет, надетый в руки (equipped:true), не предлагается — это Разоружение, не эта функция", () => {
    const belt = beltItem();
    const held = gearItem("held1", "В руках", { equipped: true });
    const v = victimActor([belt, held], {});
    const items = stealableItems(v);
    expect(items.find(i => i.id === "held1")).toBeUndefined();
  });
});

describe("useStealFromRig — магнитный замок", () => {
  it("без Боевого контакта — отказ, тест не бросается", async () => {
    const belt = beltItem();
    const knife = gearItem("knife1", "Нож");
    const v = victimActor([belt, knife], { knife1: "belt1:m:0:0" });
    const t = thiefActor();

    await useStealFromRig(t, v, "knife1", { melee: false });

    expect(captured.warnings.length).toBe(1);
    expect(captured.chat.length).toBe(0);
    expect(t._created.length).toBe(0);
  });

  it("в Боевом контакте, успешный S−30 — предмет переходит вору", async () => {
    captured.nextRoll = 5; // S 40 - 30 = 10, 5 <= 10 успех
    const belt = beltItem();
    const knife = gearItem("knife1", "Нож");
    const v = victimActor([belt, knife], { knife1: "belt1:m:0:0" });
    const t = thiefActor({ sb: 40 });

    await useStealFromRig(t, v, "knife1", { melee: true });

    expect(t._created.length).toBe(1);
    expect(t._created[0].name).toBe("Нож");
    expect(deletedIds).toContain("knife1");
    expect(captured.chat.length).toBe(1);
  });

  it("в Боевом контакте, провал S−30 — предмет остаётся у жертвы", async () => {
    captured.nextRoll = 50; // S 40 - 30 = 10, 50 > 10 провал
    const belt = beltItem();
    const knife = gearItem("knife1", "Нож");
    const v = victimActor([belt, knife], { knife1: "belt1:m:0:0" });
    const t = thiefActor({ sb: 40 });

    await useStealFromRig(t, v, "knife1", { melee: true });

    expect(t._created.length).toBe(0);
    expect(deletedIds).toEqual([]);
  });
});

describe("useStealFromRig — карман/не замок", () => {
  it("вне контакта и без Телекинеза — отказ", async () => {
    const belt = beltItem();
    const loose = gearItem("loose1", "Мелочь");
    const v = victimActor([belt, loose], {});
    const t = thiefActor();

    await useStealFromRig(t, v, "loose1", { melee: false });

    expect(captured.warnings.length).toBe(1);
    expect(t._created.length).toBe(0);
  });

  it("вне контакта, но с Телекинезом — забирает без теста", async () => {
    const belt = beltItem();
    const loose = gearItem("loose1", "Мелочь");
    const v = victimActor([belt, loose], {});
    const t = thiefActor({ psychicPowers: [{ type: "psychicPower", system: { discipline: "telekinesis" } }] });

    await useStealFromRig(t, v, "loose1", { melee: false });

    expect(t._created.length).toBe(1);
    expect(deletedIds).toContain("loose1");
  });

  it("в Боевом контакте, без Телекинеза — забирает свободно", async () => {
    const belt = beltItem();
    const loose = gearItem("loose1", "Мелочь");
    const v = victimActor([belt, loose], {});
    const t = thiefActor();

    await useStealFromRig(t, v, "loose1", { melee: true });

    expect(t._created.length).toBe(1);
  });

  it("не хватает ОД — отказ, предмет не переходит", async () => {
    const belt = beltItem();
    const loose = gearItem("loose1", "Мелочь");
    const v = victimActor([belt, loose], {});
    const t = thiefActor({ ap: 0 });
    globalThis.game.combat = { started: true };

    await useStealFromRig(t, v, "loose1", { melee: true });

    expect(t._created.length).toBe(0);
    delete globalThis.game.combat;
  });
});

// wdbc-0uol (живой тест 18.09.2026): кнопка Token HUD гейтилась victim.isOwner,
// а у ГМа Foundry isOwner всегда true на ЛЮБОМ документе (обход прав ядра,
// не «это мой персонаж?») — кнопка не рендерилась вовсе ни на одном токене,
// в т.ч. чужих NPC. Правильный гейт — сравнение с актором ПОД КОНТРОЛЕМ.
describe("initRigStealHud — гейт кнопки Token HUD", () => {
  // fake DOM: минимум, чтобы код дошёл до add/skip кнопки, не трогая jsdom.
  class FakeElement {
    constructor() { this.children = []; this.classList = new Set(); }
    querySelector(sel) {
      if (sel === ".wh-steal-btn") return this.children.find(c => c.className?.includes("wh-steal-btn")) ?? null;
      return null; // ни .col.right/.col-right/.right — appendChild пойдёт на el самого
    }
    appendChild(child) { this.children.push(child); }
  }

  let handlers, origCreateElement;

  beforeEach(() => {
    handlers = {};
    globalThis.HTMLElement = class {}; // инстанс FakeElement им не является — код возьмёт html?.[0]
    globalThis.Hooks.on = (name, fn) => { (handlers[name] ??= []).push(fn); };
    origCreateElement = globalThis.document?.createElement;
    globalThis.document = {
      createElement: () => ({ classList: new Set(), addEventListener() {}, set className(v) { this._className = v; }, get className() { return this._className; } })
    };
    initRigStealHud();
  });

  afterEach(() => { if (origCreateElement) globalThis.document.createElement = origCreateElement; });

  function fireRenderTokenHUD(hud, el) {
    for (const fn of handlers.renderTokenHUD ?? []) fn(hud, [el]);
  }

  it("victim ≠ актор под контролем (даже victim.isOwner:true, как у ГМ) — кнопка добавляется", () => {
    const victim = { id: "npc-1", type: "character", isOwner: true };
    const hud = { object: { document: { actor: victim } } };
    globalThis.canvas = { tokens: { controlled: [{ actor: { id: "pc-1" } }] } };
    const el = new FakeElement();

    fireRenderTokenHUD(hud, el);

    expect(el.children.length).toBe(1);
  });

  it("victim = СВОЙ актор под контролем — кнопка НЕ добавляется", () => {
    const victim = { id: "pc-1", type: "character", isOwner: true };
    const hud = { object: { document: { actor: victim } } };
    globalThis.canvas = { tokens: { controlled: [{ actor: { id: "pc-1" } }] } };
    const el = new FakeElement();

    fireRenderTokenHUD(hud, el);

    expect(el.children.length).toBe(0);
  });

  it("ничего не под контролем — кнопка всё равно добавляется (клик сам предупредит)", () => {
    const victim = { id: "npc-1", type: "character", isOwner: false };
    const hud = { object: { document: { actor: victim } } };
    globalThis.canvas = { tokens: { controlled: [] } };
    const el = new FakeElement();

    fireRenderTokenHUD(hud, el);

    expect(el.children.length).toBe(1);
  });
});
