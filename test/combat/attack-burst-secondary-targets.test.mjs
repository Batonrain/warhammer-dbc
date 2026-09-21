// test/combat/attack-burst-secondary-targets.test.mjs
//
// Стр. 35, wdbc-x1nz.2.55: Короткая/Длинная Очередь может распределить
// попадания по другим целям в пределах 2м от основной. Дистанция — настоящий
// замер (tactical-map.mjs::measureTokens), не текстовая заглушка; само
// распределение остаётся за столом (см. attack-card.mjs::burstSecondaryHtml).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

/** Токен-заглушка — тот же приём, что test/combat/tactical-map.test.mjs. */
function token({ name, x = 0, y = 0, width = 1, height = 1 } = {}) {
  const actor = { name };
  return { actor, document: { x, y, width, height } };
}

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
  globalThis.game.user = { ...globalThis.game.user, targets: new Set() };
});

describe("Вторичные цели Очереди (wdbc-x1nz.2.55)", () => {
  it("токен в 1м от основной цели — попадает в список вторичных с дистанцией", async () => {
    const primary   = token({ name: "Основная цель", x: 0, y: 0 });
    const secondary = token({ name: "Сосед вплотную", x: 1, y: 0 });
    globalThis.canvas.tokens.placeables = [primary, secondary];
    globalThis.game.user.targets = new Set([primary]);

    const weapon = weaponFor({ rof_full: 4 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [1, 3, 3, 3, 3]; // Порог 40, rv=1 → deg=4 → 4 попадания (full)

    await _executeAttackRoll(actor, weapon, "bs", 40, "full", null, {});

    expect(card()).toContain("Вторичные цели Очереди");
    expect(card()).toContain("Сосед вплотную");
    expect(card()).toContain("0.0м"); // токены впритык — edge-дистанция 0
  });

  it("токен дальше 2м — не попадает в список", async () => {
    const primary = token({ name: "Основная цель", x: 0, y: 0 });
    const distant = token({ name: "Далёкий", x: 10, y: 0 });
    globalThis.canvas.tokens.placeables = [primary, distant];
    globalThis.game.user.targets = new Set([primary]);

    const weapon = weaponFor({ rof_full: 4 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [1, 3, 3, 3, 3];

    await _executeAttackRoll(actor, weapon, "bs", 40, "full", null, {});

    expect(card()).not.toContain("Далёкий");
    expect(card()).not.toContain("Вторичные цели Очереди");
  });

  it("одно попадание (Одиночный/1 успех) — список вторичных не рендерится вовсе", async () => {
    const primary   = token({ name: "Основная цель", x: 0, y: 0 });
    const secondary = token({ name: "Сосед", x: 1, y: 0 });
    globalThis.canvas.tokens.placeables = [primary, secondary];
    globalThis.game.user.targets = new Set([primary]);

    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 3];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("Вторичные цели Очереди");
  });

  it("рукопашная атака — список вторичных не считается (правило только стрелковых Очередей)", async () => {
    const primary   = token({ name: "Основная цель", x: 0, y: 0 });
    const secondary = token({ name: "Сосед", x: 1, y: 0 });
    globalThis.canvas.tokens.placeables = [primary, secondary];
    globalThis.game.user.targets = new Set([primary]);

    const weapon = weaponFor({ weaponClass: "melee", weaponType: "chain", damage: "1d10+2", damageType: "R" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 3];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).not.toContain("Вторичные цели Очереди");
  });

  it("без выбранной основной цели (game.user.targets пуст) — список пуст", async () => {
    const secondary = token({ name: "Сосед", x: 1, y: 0 });
    globalThis.canvas.tokens.placeables = [secondary];

    const weapon = weaponFor({ rof_full: 4 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [1, 3, 3, 3, 3];

    await _executeAttackRoll(actor, weapon, "bs", 40, "full", null, {});

    expect(card()).not.toContain("Вторичные цели Очереди");
  });
});
