// test/hooks-breach-first-warning.test.mjs
//
// wdbc-rad-button-msg: подсказка «сначала примените урон» у кнопок «при
// пробитии брони» называла выделенный токен (часто — самого стрелка), а не
// цель атаки с карточки. Теперь называется цель из flags.attack.targetUuid.

import "./support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";

const { breachFirstWarning } = await import("../module/hooks.mjs");

const shooter = { uuid: "Actor.s", name: "Стрелок" };
const victim  = { uuid: "Actor.v", name: "Жертва" };

function withMessage(targetUuid) {
  globalThis.game.messages = { get: id => (id === "m1" ? { flags: { "warhammer-dbc": { attack: { targetUuid } } } } : undefined) };
  globalThis.fromUuidSync = uuid => (uuid === victim.uuid ? victim : null);
}

afterEach(() => { delete globalThis.fromUuidSync; });

describe("breachFirstWarning", () => {
  it("выделен стрелок — подсказка называет цель атаки, а не стрелка", () => {
    withMessage(victim.uuid);
    const msg = breachFirstWarning("Рад", shooter, "m1");
    expect(msg).toContain("цель атаки — Жертва");
    expect(msg).toContain("выделен Стрелок");
  });

  it("выделена сама цель — обычная подсказка с её именем", () => {
    withMessage(victim.uuid);
    const msg = breachFirstWarning("Рад", victim, "m1");
    expect(msg).toContain("сначала примените урон этой атаки к Жертва");
    expect(msg).not.toContain("выделен");
  });

  it("цели на карточке нет — имя выделенного токена, как раньше", () => {
    withMessage(null);
    expect(breachFirstWarning("Рад", shooter, "m1")).toContain("к Стрелок");
  });
});
