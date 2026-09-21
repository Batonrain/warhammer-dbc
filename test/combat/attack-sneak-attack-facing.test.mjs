// test/combat/attack-sneak-attack-facing.test.mjs
//
// Скрытная Атака (стр. 32, wdbc-1rno.3): «Если атакующий весь свой Ход
// находился вне обзора цели ... эта атака получает тип Незримое». Здесь —
// сквозной прогон через _executeAttackRoll: атакующий вне сектора обзора
// защищающегося на момент атаки → wp.unseen=true → карточка гейтит
// Уклонение/Парирование тем же путём, что и любое другое Незримое (см.
// attack-card.test.mjs, «Незримое: гейт Уклонения/Парирования»). Чистая
// геометрия — test/combat/facing.test.mjs::isOutsideDefenderView.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

/** Токен защищающегося (цель атаки) на месте game.user.targets — форма Token, не {actor}. */
function targetToken(actor, { x = 0, y = 0, rotation = 0, sight } = {}) {
  return { actor, document: { x, y, width: 1, height: 1, rotation, ...(sight ? { sight } : {}) } };
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [10, 5];
  globalThis.canvas = { tokens: { placeables: [] } };
  globalThis.game.user = { ...globalThis.game.user, targets: new Set() };
});

function withAttackerToken(actor, pos) {
  actor.uuid = "Actor.attacker-1";
  globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : null);
  globalThis.canvas.tokens.placeables = [{ actor, document: { x: pos.x, y: pos.y, width: 1, height: 1, rotation: pos.rotation ?? 0 } }];
}

describe("Скрытная Атака: геометрия facing на момент атаки даёт Незримое", () => {
  it("атакующий позади защищающегося (вне дефолтного сектора 210°) — Уклонение/Парирование unseen-locked", async () => {
    const weapon = weaponFor();
    const actor = actorFor({ items: [weapon] });
    withAttackerToken(actor, { x: 0, y: 300 }); // южнее защищающегося

    const defender = actorFor();
    globalThis.game.user.targets = new Set([targetToken(defender, { x: 0, y: 0, rotation: 0 })]); // смотрит на север

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain("wh-unseen-detect-btn");
    expect(card()).toContain('class="wh-dodge-btn wh-unseen-locked" type="button" disabled');
  });

  it("атакующий спереди — в секторе обзора, обычное Уклонение", async () => {
    const weapon = weaponFor();
    const actor = actorFor({ items: [weapon] });
    withAttackerToken(actor, { x: 0, y: -300 }); // севернее защищающегося

    const defender = actorFor();
    globalThis.game.user.targets = new Set([targetToken(defender, { x: 0, y: 0, rotation: 0 })]);

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).not.toContain("wh-unseen-detect-btn");
    expect(card()).toContain('<button class="wh-dodge-btn" type="button"');
  });

  it("защищающийся с явным круговым обзором (sight.angle=360) — атака сзади не становится Незримой этим путём", async () => {
    const weapon = weaponFor();
    const actor = actorFor({ items: [weapon] });
    withAttackerToken(actor, { x: 0, y: 300 });

    const defender = actorFor();
    globalThis.game.user.targets = new Set([targetToken(defender, { x: 0, y: 0, rotation: 0, sight: { angle: 360 } })]);

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).not.toContain("wh-unseen-detect-btn");
  });

  it("нет токена атакующего на сцене — геометрии посчитать не из чего, атака остаётся обычной", async () => {
    const weapon = weaponFor();
    const actor = actorFor({ items: [weapon] }); // без uuid/токена
    const defender = actorFor();
    globalThis.game.user.targets = new Set([targetToken(defender, { x: 0, y: 0, rotation: 0 })]);

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).not.toContain("wh-unseen-detect-btn");
  });

  it("Janus у защищающегося (rules/janus.mjs) — атака сзади НЕ становится Незримой этим путём", async () => {
    const weapon = weaponFor();
    const actor = actorFor({ items: [weapon] });
    actor.uuid = "Actor.attacker-1";
    globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : null);
    globalThis.canvas.tokens.placeables = [{ actor, document: { x: 0, y: 300, width: 1, height: 1, rotation: 0 } }];

    const defender = actorFor({ items: [{ id: "janus-1", type: "mutation", name: "Janus / Янус", system: {} }] });
    globalThis.game.user.targets = new Set([targetToken(defender, { x: 0, y: 0, rotation: 0 })]); // смотрит на север, атакующий южнее (сзади)

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).not.toContain("wh-unseen-detect-btn");
  });
});
