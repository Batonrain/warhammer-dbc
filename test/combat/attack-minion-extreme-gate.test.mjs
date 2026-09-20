// test/combat/attack-minion-extreme-gate.test.mjs
//
// Стр. 34, wdbc-x1nz.2.51: «Маловажные NPC... не могут наносить Экстремальный
// Урон», пока Командование явно не дало им эту способность (Командное
// Присутствие «Экстремальный Урон» — module/rules/squad-roles.mjs::
// minionCanCauseExtremeDamage, уже проверена отдельно в
// test/rules/squad-roles.test.mjs). Здесь — сквозной прогон через
// _executeAttackRoll: гейт должен реально гасить hasExtreme в карточке.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});
afterEach(() => { delete globalThis.game.actors; delete globalThis.fromUuidSync; });

describe("Маловажный NPC (миньон) без Командования не наносит Экстремальный Урон", () => {
  it("обычный персонаж (не миньон) — Экстремальный Урон проходит как обычно", async () => {
    const weapon = weaponFor({ damage: "1d10+5" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 10, 3]; // урон: 1d10=10 — максимальная грань, экстрим-порог
    globalThis.game.actors = [];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Экстремальный урон");
  });

  it("миньон без Командования — тот же максимальный кубик НЕ даёт Экстремальный Урон", async () => {
    const weapon = weaponFor({ damage: "1d10+5" });
    const actor  = actorFor({ items: [weapon] });
    actor.type = "minion";
    actor.uuid = "Actor.min1";
    actor.getFlag = () => undefined;
    captured.dice = [10, 10, 3];
    globalThis.game.actors = [];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("Экстремальный урон");
  });

  it("миньон в Отряде с Присутствием «Экстремальный Урон» — снова наносит", async () => {
    const weapon = weaponFor({ damage: "1d10+5" });
    const actor  = actorFor({ items: [weapon] });
    actor.type = "minion";
    actor.uuid = "Actor.min1";
    actor.getFlag = () => undefined;
    captured.dice = [10, 10, 3];
    globalThis.game.actors = [{
      type: "squad",
      system: { posts: {}, members: [{ uuid: actor.uuid }], presence: { active: true, benefit: "extreme" } }
    }];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Экстремальный урон");
  });
});
