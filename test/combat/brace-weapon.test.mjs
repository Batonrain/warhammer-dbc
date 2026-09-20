// test/combat/brace-weapon.test.mjs
//
// Стр. 35, wdbc-x1nz.2.56: «Закрепление: Действие: Полудействие; Тип:
// Физическое. ...Пока он не сдвинется с места, или не повернёт оружие вне
// сектора обстрела (±45° для большинства) оружие считается Закреплённым.»
// Раньше это была только галочка на любой атаке без цены и без состояния —
// теперь настоящее Действие с состоянием (позиция+разворот токена).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { declareBrace, isBraced, clearBrace, BRACE_ARC_WIDTH } from "../../module/combat/brace-weapon.mjs";

/** Актор с getFlag/setFlag/unsetFlag — состояние Закрепления живёт флагом. */
function braceActor(overrides = {}) {
  const a = actorFor(overrides);
  a.type = "character";
  a.uuid = "Actor.a1";
  a.system.actionPoints = { value: 2, max: 2 };
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  a.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split(".");
      let node = a;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
  };
  return a;
}

function placeToken(actor, { x = 0, y = 0, width = 1, height = 1, rotation = 0 } = {}) {
  globalThis.canvas.tokens.placeables.push({ actor, document: { x, y, width, height, rotation } });
}

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
  globalThis.game.combat = { started: true };
});
afterEach(() => { globalThis.game.combat = undefined; });

describe("declareBrace", () => {
  it("тяжёлое оружие, есть токен — тратит 1 ОД, ставит флаг, постит карточку", async () => {
    const weapon = weaponFor({ weaponClass: "heavy" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon] });
    placeToken(actor, { x: 5, y: 5, rotation: 90 });

    await declareBrace(actor, weapon);

    expect(actor.system.actionPoints.value).toBe(1);
    expect(isBraced(actor, weapon)).toBe(true);
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Закреплено");
  });

  it("не тяжёлое оружие — отказ, ОД не тратятся", async () => {
    const weapon = weaponFor({ weaponClass: "basic" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon] });
    placeToken(actor);

    await declareBrace(actor, weapon);

    expect(actor.system.actionPoints.value).toBe(2);
    expect(captured.warnings.length).toBeGreaterThan(0);
  });

  it("нет токена на сцене — отказ, ОД не тратятся", async () => {
    const weapon = weaponFor({ weaponClass: "heavy" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon] });

    await declareBrace(actor, weapon);

    expect(actor.system.actionPoints.value).toBe(2);
    expect(captured.warnings.length).toBeGreaterThan(0);
  });

  it("не хватает ОД — отказ, флаг не ставится", async () => {
    const weapon = weaponFor({ weaponClass: "heavy" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon] });
    actor.system.actionPoints.value = 0;
    placeToken(actor);

    await declareBrace(actor, weapon);

    expect(isBraced(actor, weapon)).toBe(false);
  });
});

describe("isBraced", () => {
  it("токен не сдвинулся и не довернут — Закреплено", async () => {
    const weapon = weaponFor({ weaponClass: "heavy" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon] });
    placeToken(actor, { x: 0, y: 0, rotation: 0 });
    await declareBrace(actor, weapon);

    expect(isBraced(actor, weapon)).toBe(true);
  });

  it("токен сдвинулся с места — Закрепление слетело", async () => {
    const weapon = weaponFor({ weaponClass: "heavy" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon] });
    const list = globalThis.canvas.tokens.placeables;
    placeToken(actor, { x: 0, y: 0, rotation: 0 });
    await declareBrace(actor, weapon);

    list[0].document.x = 5; // передвинулся
    expect(isBraced(actor, weapon)).toBe(false);
  });

  it(`доворот в пределах ±${BRACE_ARC_WIDTH / 2}° — Закрепление держится`, async () => {
    const weapon = weaponFor({ weaponClass: "heavy" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon] });
    const list = globalThis.canvas.tokens.placeables;
    placeToken(actor, { x: 0, y: 0, rotation: 100 });
    await declareBrace(actor, weapon);

    list[0].document.rotation = 100 + (BRACE_ARC_WIDTH / 2); // ровно на границе
    expect(isBraced(actor, weapon)).toBe(true);
  });

  it(`доворот за пределы ±${BRACE_ARC_WIDTH / 2}° — Закрепление слетело`, async () => {
    const weapon = weaponFor({ weaponClass: "heavy" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon] });
    const list = globalThis.canvas.tokens.placeables;
    placeToken(actor, { x: 0, y: 0, rotation: 100 });
    await declareBrace(actor, weapon);

    list[0].document.rotation = 100 + (BRACE_ARC_WIDTH / 2) + 1;
    expect(isBraced(actor, weapon)).toBe(false);
  });

  it("Закреплено другое оружие того же актора — это не Закреплено", async () => {
    const weaponA = weaponFor({ weaponClass: "heavy" }, { id: "w1" });
    const weaponB = weaponFor({ weaponClass: "heavy" }, { id: "w2" });
    const actor   = braceActor({ items: [weaponA, weaponB] });
    placeToken(actor);
    await declareBrace(actor, weaponA);

    expect(isBraced(actor, weaponB)).toBe(false);
  });

  it("флага нет вовсе — не Закреплено", () => {
    const weapon = weaponFor({ weaponClass: "heavy" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon] });
    placeToken(actor);

    expect(isBraced(actor, weapon)).toBe(false);
  });

  it("токен пропал со сцены после Закрепления — не Закреплено (геометрию посчитать не из чего)", async () => {
    const weapon = weaponFor({ weaponClass: "heavy" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon] });
    placeToken(actor);
    await declareBrace(actor, weapon);

    globalThis.canvas.tokens.placeables = [];
    expect(isBraced(actor, weapon)).toBe(false);
  });
});

describe("clearBrace", () => {
  it("снимает флаг явно", async () => {
    const weapon = weaponFor({ weaponClass: "heavy" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon] });
    placeToken(actor);
    await declareBrace(actor, weapon);
    expect(isBraced(actor, weapon)).toBe(true);

    await clearBrace(actor);
    expect(isBraced(actor, weapon)).toBe(false);
  });
});
