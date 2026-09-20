// test/combat/movement-menu-items.test.mjs
//
// wdbc-zdu4: вкладка «Движение» боевого HUD переиспользует один и тот же
// список пунктов, что и Dialog showMovementMenu (Token HUD/вкладка БОЙ) —
// movementMenuItems(actor). Тест проверяет сам список (гейты по бою/Талантам/
// полёту), а не Dialog — отрисовка Dialog нуждается в живом Foundry.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { movementMenuItems } from "../../module/combat/movement-actions.mjs";

function fakeActor({ items = [], flags = {} } = {}) {
  return { name: "Подставной", system: {}, items, getFlag: (scope, key) => flags[scope]?.[key] };
}

afterEach(() => { globalThis.game.combat = undefined; });

describe("movementMenuItems", () => {
  it("вне Encounter — только внебоевые пункты (Карабканье/Прыжок/Плавание/Падение + марши), без боевых", () => {
    const items = movementMenuItems(fakeActor());
    const keys = items.map(i => i.key);
    expect(keys).not.toContain("halfmove");
    expect(keys).not.toContain("fullmove");
    expect(keys).not.toContain("charge");
    expect(keys).not.toContain("run");
    expect(keys).not.toContain("disengage");
    expect(keys).toEqual(expect.arrayContaining(["climb", "jump", "swim", "fall", "marchA", "marchR", "marchF"]));
  });

  it("в активном Encounter — боевые пункты есть, марши пропадают", () => {
    globalThis.game.combat = { started: true };
    const items = movementMenuItems(fakeActor());
    const keys = items.map(i => i.key);
    expect(keys).toEqual(expect.arrayContaining(["halfmove", "fullmove", "charge", "run", "disengage"]));
    expect(keys).not.toContain("marchA");
  });

  // Стр. 30, wdbc-x1nz.2.36-39: Вольт/Перебежка — боевые пункты; Лечь/Встать
  // взаимоисключающие по текущему Состоянию «Повален».
  it("в бою — Вольт и Перебежка есть", () => {
    globalThis.game.combat = { started: true };
    const keys = movementMenuItems(fakeActor()).map(i => i.key);
    expect(keys).toContain("vault");
    expect(keys).toContain("duckAndCover");
  });

  it("не Повален — пункт «Лечь» есть, «Встать» нет", () => {
    globalThis.game.combat = { started: true };
    const keys = movementMenuItems(fakeActor()).map(i => i.key);
    expect(keys).toContain("prone");
    expect(keys).not.toContain("standup");
  });

  it("Повален — пункт «Встать» есть, «Лечь» нет", () => {
    globalThis.game.combat = { started: true };
    const actor = fakeActor();
    actor.system.conditions = { prone: true };
    const keys = movementMenuItems(actor).map(i => i.key);
    expect(keys).toContain("standup");
    expect(keys).not.toContain("prone");
  });

  it("без Таланта Half-Step — пункта halfstep нет даже в бою", () => {
    globalThis.game.combat = { started: true };
    const items = movementMenuItems(fakeActor());
    expect(items.map(i => i.key)).not.toContain("halfstep");
  });

  it("с Талантом Half-Step — пункт halfstep появляется в бою", () => {
    globalThis.game.combat = { started: true };
    const actor = fakeActor({ items: [{ type: "talent", name: "Half-Step" }] });
    expect(movementMenuItems(actor).map(i => i.key)).toContain("halfstep");
  });

  it("без соответствующей Черты/Таланта полёта — пункта fly нет", () => {
    const items = movementMenuItems(fakeActor());
    expect(items.map(i => i.key)).not.toContain("fly");
  });

  it("каждый пункт умеет action() без падения (не проверяем побочный эффект — только что вызов не бросает)", () => {
    const items = movementMenuItems(fakeActor());
    for (const it of items) expect(typeof it.action).toBe("function");
  });

  // wdbc-x1nz.2.19: пункт-тумблер Глубокого Контакта всегда доступен (не
  // завязан на isEncounterActive — переноска может начаться вне боя), метка
  // читает текущее состояние флага.
  it("Глубокий Контакт: пункт есть всегда, метка меняется по флагу", () => {
    const off = movementMenuItems(fakeActor()).find(i => i.key === "deepContactCarry");
    expect(off.label).toBe("Глубокий Контакт: несу/держу");

    const on = movementMenuItems(fakeActor({ flags: { "warhammer-dbc": { deepContactCarry: true } } }))
      .find(i => i.key === "deepContactCarry");
    expect(on.label).toBe("Глубокий Контакт: закончить переноску");
  });
});
