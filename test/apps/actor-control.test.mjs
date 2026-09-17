// test/apps/actor-control.test.mjs
import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import {
  attemptSeizeControl, requestControlOwnership, grantControlOwnership,
  requestRevokeControlOwnership, revokeControlOwnership
} from "../../module/apps/actor-control.mjs";
import { isControlled, controllerUuidOf } from "../../module/rules/actor-control.mjs";

beforeEach(() => { resetCaptured(); captured.dice = [10]; });

/** Актор с getFlag/setFlag/unsetFlag хранилищем — тот же приём, что attacker() в test/combat/defense.test.mjs. */
function flaggedActor(overrides = {}) {
  const a = actorFor(overrides);
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  return a;
}

describe("attemptSeizeControl", () => {
  it("нет цели — предупреждение, диалог не открывается", async () => {
    globalThis.game.user.targets = [];
    const actor = actorFor({});
    await attemptSeizeControl(actor, { label: "Захват" });
    expect(captured.dialog).toBeNull();
    expect(captured.warnings.some(w => w.includes("цел"))).toBe(true);
  });

  it("успешный бросок — устанавливает контроль над целью (game.user.targets)", async () => {
    const actor = actorFor({});
    actor.uuid = "Actor.seizer";
    const target = flaggedActor({});
    globalThis.game.user.targets = [{ actor: target }];

    await attemptSeizeControl(actor, { label: "Захват", defaultChar: "ws", controlOpts: { permanent: true, sourceItemUuid: "Item.x" } });

    // WS 45 (actorFor), untrained -20, без extraBonus → база "self" всё равно
    // считается через baseVal техники (характеристика без штрафа Ранга —
    // Состязания книги не вычитают Ранг Навыка, только характеристику).
    const html = fakeHtml({ "#contest-char": "ws", "#contest-self": "45", "#contest-mod": "0" });
    await captured.dialog.buttons.roll.callback(html);

    expect(isControlled(target)).toBe(true);
    expect(controllerUuidOf(target)).toBe(actor.uuid);
  });

  it("провал броска — контроль не устанавливается", async () => {
    captured.dice = [96];
    const actor = actorFor({});
    const target = flaggedActor({});
    globalThis.game.user.targets = [{ actor: target }];

    await attemptSeizeControl(actor, { label: "Захват", defaultChar: "ws" });
    const html = fakeHtml({ "#contest-char": "ws", "#contest-self": "45", "#contest-mod": "0" });
    await captured.dialog.buttons.roll.callback(html);

    expect(isControlled(target)).toBe(false);
  });
});

describe("requestControlOwnership / requestRevokeControlOwnership — relay через ГМ", () => {
  const controllerUserId = "user-controller";

  function actorWithOwner(uuid) {
    const a = actorFor({});
    a.uuid = uuid;
    return a;
  }

  beforeEach(() => {
    globalThis.CONST = { ...globalThis.CONST, DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } };
    globalThis.game.users = {
      find: fn => [{ id: controllerUserId, character: { uuid: "Actor.controller" }, isGM: false }].find(fn),
      get: () => undefined,
      activeGM: null
    };
  });
  afterEach(() => { delete globalThis.game.users; });

  it("нет игрока за контролёром — предупреждение, ничего не эмитит", async () => {
    const target = actorWithOwner("Actor.target");
    target.updates = [];
    target.update = async d => { target.updates.push(d); };
    const controller = actorWithOwner("Actor.unknown-controller");

    const res = await requestControlOwnership(target, controller);
    expect(res.ok).toBe(false);
    expect(captured.warnings.length).toBeGreaterThan(0);
    expect(target.updates.length).toBe(0);
  });

  it("ГМ — правит напрямую, без сокета", async () => {
    globalThis.game.user = { id: "gm-1", isGM: true };
    const target = actorWithOwner("Actor.target");
    target.updates = [];
    target.update = async d => { target.updates.push(d); return d; };
    const controller = actorWithOwner("Actor.controller");

    const res = await requestControlOwnership(target, controller);
    expect(res.ok).toBe(true);
    expect(target.updates).toEqual([{ [`ownership.${controllerUserId}`]: 3 }]);
  });

  it("не ГМ, активный ГМ есть — эмитит сокет-запрос, актора не трогает", async () => {
    globalThis.game.user = { id: "player-1", isGM: false };
    globalThis.game.users.activeGM = { id: "gm-1" };
    const emitted = [];
    globalThis.game.socket = { emit: (channel, data) => emitted.push({ channel, data }) };
    const target = actorWithOwner("Actor.target");
    target.update = async () => { throw new Error("не должно вызываться у не-ГМ"); };
    const controller = actorWithOwner("Actor.controller");

    const res = await requestControlOwnership(target, controller);
    expect(res).toEqual({ ok: true, relayed: true });
    expect(emitted).toEqual([{ channel: "system.warhammer-dbc",
      data: { action: "grantActorControlOwnership", userId: "player-1", targetUuid: "Actor.target", controllerUserId } }]);
  });

  it("не ГМ, нет активного ГМ — предупреждение, не эмитит", async () => {
    globalThis.game.user = { id: "player-1", isGM: false };
    globalThis.game.users.activeGM = null;
    const emitted = [];
    globalThis.game.socket = { emit: (channel, data) => emitted.push({ channel, data }) };
    const target = actorWithOwner("Actor.target");
    const controller = actorWithOwner("Actor.controller");

    const res = await requestControlOwnership(target, controller);
    expect(res.ok).toBe(false);
    expect(emitted.length).toBe(0);
    expect(captured.warnings.some(w => w.includes("Мастера"))).toBe(true);
  });

  it("revoke — удаляет персональный override владения (delete-key), не восстанавливает число", async () => {
    globalThis.game.user = { id: "gm-1", isGM: true };
    const target = actorWithOwner("Actor.target");
    target.updates = [];
    target.update = async d => { target.updates.push(d); return d; };
    const controller = actorWithOwner("Actor.controller");

    await requestRevokeControlOwnership(target, controller);
    expect(target.updates).toEqual([{ [`ownership.-=${controllerUserId}`]: null }]);
  });
});

describe("grantControlOwnership / revokeControlOwnership — исполняющая сторона (без relay-развилки)", () => {
  beforeEach(() => {
    globalThis.CONST = { ...globalThis.CONST, DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } };
  });

  it("grantControlOwnership пишет OWNER на конкретного пользователя", async () => {
    const target = actorFor({});
    target.updates = [];
    target.update = async d => { target.updates.push(d); return d; };
    await grantControlOwnership(target, "user-x");
    expect(target.updates).toEqual([{ "ownership.user-x": 3 }]);
  });

  it("revokeControlOwnership удаляет override", async () => {
    const target = actorFor({});
    target.updates = [];
    target.update = async d => { target.updates.push(d); return d; };
    await revokeControlOwnership(target, "user-x");
    expect(target.updates).toEqual([{ "ownership.-=user-x": null }]);
  });
});
