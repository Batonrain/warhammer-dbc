// test/combat/flight-altitude.test.mjs
//
// Полёт (стр. 30), wdbc-x1nz.2:
//  - Hoverer БЕЗ Flyer поднимается только на Приземную — Низкая/Высокая
//    требуют именно Flyer.
//  - «landed» (не летит) — явное состояние, а не молчаливый дефолт на
//    «Приземная» (иначе пеший Flyer получал бы автоигнор Трудного Ландшафта).
//  - TokenDocument#elevation синхронизируется с выбранным тиром.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { showFlightDialog, actorHasFlyer, actorCanFly } from "../../module/combat/movement-actions.mjs";

function traitItem(name) { return { type: "trait", name, system: {} }; }

// system.movement.altitude НИКОГДА не бывает пустым/undefined у настоящего
// Foundry-актора — DataModel всегда заполняет поле своим initial ("landed",
// _creature.mjs). Фикстура с пустым movement:{} маскировала wdbc-x1nz.2.16
// (initial реально был "ground" — || "landed" в showFlightDialog никогда не
// срабатывал) — найдено живым тестом, не этим файлом. Дефолт фикстуры ниже
// повторяет реальную форму документа, а не «удобное пустое место».
function actorWith(items, { elevation = 0, altitude = "landed" } = {}) {
  const tokenDocs = [{ elevation, update: async (d) => Object.assign(tokenDocs[0], d) }];
  return {
    name: "Подставной", items,
    system: { movement: { altitude } },
    update: async function (data) { Object.assign(this.system, unflatten(data)); },
    getActiveTokens: () => tokenDocs,
    __tokenDocs: tokenDocs
  };
}

// «system.movement.altitude»-путь → вложенный объект, как настоящий actor.update.
function unflatten(data) {
  const out = {};
  for (const [path, value] of Object.entries(data)) {
    const keys = path.split(".");
    let node = out;
    for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
    node[keys.at(-1)] = value;
  }
  return out.system ?? {};
}

beforeEach(resetCaptured);

describe("actorHasFlyer/actorCanFly: различает Flyer и Hoverer", () => {
  it("Hoverer без Flyer — canFly да, hasFlyer нет", () => {
    const actor = actorWith([traitItem("Hoverer (10)")]);
    expect(actorCanFly(actor)).toBe(true);
    expect(actorHasFlyer(actor)).toBe(false);
  });

  it("Flyer — оба true", () => {
    const actor = actorWith([traitItem("Flyer (2×A.b)")]);
    expect(actorCanFly(actor)).toBe(true);
    expect(actorHasFlyer(actor)).toBe(true);
  });
});

describe("showFlightDialog: Hoverer без Flyer видит только Приземную/Не летит", () => {
  it("выпадающий список не содержит опций Низкой/Высокой вовсе", async () => {
    const actor = actorWith([traitItem("Hoverer (10)")]);
    showFlightDialog(actor);
    expect(captured.dialog.content).not.toContain('value="low"');
    expect(captured.dialog.content).not.toContain('value="high"');
    expect(captured.dialog.content).toContain('value="landed"');
    expect(captured.dialog.content).toContain('value="ground"');
    expect(captured.dialog.content).toContain("Только Hoverer — доступна лишь Приземная высота");
  });

  it("защита в callback: подсунутое «low» без Flyer отклоняется, altitude не пишется", async () => {
    const actor = actorWith([traitItem("Hoverer (10)")]);
    showFlightDialog(actor);
    await captured.dialog.buttons.set.callback(fakeHtml({ "#fly-alt": "low" }));
    expect(captured.warnings.at(-1)).toContain("только Hoverer");
    expect(actor.system.movement.altitude).toBe("landed"); // не записалось — осталось прежним
  });

  it("Flyer — список содержит все четыре тира", () => {
    const actor = actorWith([traitItem("Flyer (2×A.b)")]);
    showFlightDialog(actor);
    expect(captured.dialog.content).toContain("Не летит");
    expect(captured.dialog.content).toContain("Приземная");
    expect(captured.dialog.content).toContain("Низкая");
    expect(captured.dialog.content).toContain("Высокая");
  });
});

describe("showFlightDialog: по умолчанию выбрана «Не летит», не «Приземная»", () => {
  it("текущий тир не выставлен — селект открывается на landed", () => {
    const actor = actorWith([traitItem("Flyer (2×A.b)")]);
    showFlightDialog(actor);
    expect(captured.dialog.content).toContain('value="landed" selected');
  });
});

describe("showFlightDialog: синхронизация TokenDocument#elevation", () => {
  it("Приземная — elevation 0 (не 2м буквальной книги — иначе ложный авто-бонус «Положение выше», hasHighGround)", async () => {
    const actor = actorWith([traitItem("Flyer (2×A.b)")]);
    showFlightDialog(actor);
    await captured.dialog.buttons.set.callback(fakeHtml({ "#fly-alt": "ground" }));
    expect(actor.__tokenDocs[0].elevation).toBe(0);
    expect(actor.system.movement.altitude).toBe("ground");
  });

  it("Высокая — elevation 25 (через соседний уровень: landed нельзя прыгнуть сразу в high, wdbc-x1nz.2.34)", async () => {
    const actor = actorWith([traitItem("Flyer (2×A.b)")], { altitude: "low" });
    showFlightDialog(actor);
    await captured.dialog.buttons.set.callback(fakeHtml({ "#fly-alt": "high" }));
    expect(actor.__tokenDocs[0].elevation).toBe(25);
  });

  it("Не летит — elevation обратно 0", async () => {
    const actor = actorWith([traitItem("Flyer (2×A.b)")], { elevation: 25 });
    showFlightDialog(actor);
    await captured.dialog.buttons.set.callback(fakeHtml({ "#fly-alt": "landed" }));
    expect(actor.__tokenDocs[0].elevation).toBe(0);
  });
});
