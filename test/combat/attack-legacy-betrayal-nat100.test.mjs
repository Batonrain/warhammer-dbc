// test/combat/attack-legacy-betrayal-nat100.test.mjs
//
// Наследие Предательства, Оружие Наследия (wdbc-1rno.35, История 4, стр.
// 427): «На нат. 100 на попадание оружие попадает по случайному союзнику»
// ВМЕСТО исходной цели — сквозной прогон _executeAttackRoll, тот же приём
// dice-очереди, что test/combat/attack-burst-secondary-targets.test.mjs.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const HOSTILE = -1, FRIENDLY = 1;
const card = () => captured.chat.at(-1)?.content ?? "";

function withAttackerToken(actor, pos) {
  actor.uuid = "Actor.attacker-1";
  globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : null);
  return { actor, document: { x: pos.x, y: pos.y, width: 1, height: 1, disposition: FRIENDLY } };
}

function token(actor, { x = 0, y = 0, disposition = HOSTILE } = {}) {
  return { actor, document: { x, y, width: 1, height: 1, disposition } };
}

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
  globalThis.game.user = { ...globalThis.game.user, targets: new Set() };
});

describe("Наследие Предательства: нат. 100 на попадание — рукопашная", () => {
  it("союзник в контакте с атакующим — урон уходит ему, не исходной цели", async () => {
    const weapon = weaponFor({ weaponClass: "melee", damage: "1d10+3", legacy: { historyName: "Наследие Предательства" } });
    const actor  = actorFor({ items: [weapon] });
    const attackerToken = withAttackerToken(actor, { x: 0, y: 0 });
    const allyActor = { name: "Соратник" };
    const allyToken  = token(allyActor, { x: 1, y: 0, disposition: FRIENDLY });
    const targetActor = { name: "Цель", system: {} };
    const targetTok    = token(targetActor, { x: 5, y: 0, disposition: HOSTILE });
    globalThis.canvas.tokens.placeables = [attackerToken, allyToken, targetTok];
    globalThis.game.user.targets = new Set([targetTok]);

    captured.dice = [100, 5]; // rv=100 (нат. 100), 1d10+3 → дай кубу 5
    await _executeAttackRoll(actor, weapon, "ws", 100, "melee", null, {});

    expect(card()).toContain("Наследие Предательства");
    expect(card()).toContain("Соратник");
    expect(card()).not.toContain("Применить урон");
  });

  it("нет союзника рядом — попадание остаётся по исходной цели как обычно", async () => {
    const weapon = weaponFor({ weaponClass: "melee", damage: "1d10+3", legacy: { historyName: "Наследие Предательства" } });
    const actor  = actorFor({ items: [weapon] });
    const attackerToken = withAttackerToken(actor, { x: 0, y: 0 });
    const targetActor = { name: "Цель", system: {} };
    const targetTok    = token(targetActor, { x: 5, y: 0, disposition: HOSTILE });
    globalThis.canvas.tokens.placeables = [attackerToken, targetTok];
    globalThis.game.user.targets = new Set([targetTok]);

    captured.dice = [100, 5];
    await _executeAttackRoll(actor, weapon, "ws", 100, "melee", null, {});

    expect(card()).toContain("Применить урон");
    expect(card()).not.toContain("Наследие Предательства");
  });

  it("рв не 100 — обычное попадание, даже с Историей на оружии и союзником рядом", async () => {
    const weapon = weaponFor({ weaponClass: "melee", damage: "1d10+3", legacy: { historyName: "Наследие Предательства" } });
    const actor  = actorFor({ items: [weapon] });
    const attackerToken = withAttackerToken(actor, { x: 0, y: 0 });
    const allyActor = { name: "Соратник" };
    const allyToken  = token(allyActor, { x: 1, y: 0, disposition: FRIENDLY });
    const targetActor = { name: "Цель", system: {} };
    const targetTok    = token(targetActor, { x: 5, y: 0, disposition: HOSTILE });
    globalThis.canvas.tokens.placeables = [attackerToken, allyToken, targetTok];
    globalThis.game.user.targets = new Set([targetTok]);

    captured.dice = [10, 5]; // rv=10, обычное попадание
    await _executeAttackRoll(actor, weapon, "ws", 100, "melee", null, {});

    expect(card()).toContain("Применить урон");
    expect(card()).not.toContain("Наследие Предательства");
  });
});

describe("Наследие Предательства: нат. 100 на попадание — стрелковая (3м от цели)", () => {
  it("союзник в 3м от ЦЕЛИ — урон уходит ему", async () => {
    const weapon = weaponFor({
      weaponClass: "basic", damage: "1d10+3", legacy: { historyName: "Наследие Предательства" },
      weaponProps: [{ key: "veryReliable" }] // нат. 100 не должен заклинить оружие в этом тесте — тестируем именно Предательство
    });
    const actor  = actorFor({ items: [weapon] });
    const attackerToken = withAttackerToken(actor, { x: 0, y: 0 });
    const targetActor = { name: "Цель", system: {} };
    const targetTok    = token(targetActor, { x: 10, y: 0, disposition: HOSTILE });
    const allyActor = { name: "Напарник" };
    const allyToken  = token(allyActor, { x: 13, y: 0, disposition: HOSTILE }); // союзник ЦЕЛИ (disposition совпал с её), 3м от неё
    globalThis.canvas.tokens.placeables = [attackerToken, targetTok, allyToken];
    globalThis.game.user.targets = new Set([targetTok]);

    captured.dice = [100, 5];
    await _executeAttackRoll(actor, weapon, "bs", 100, "single", null, {});

    expect(card()).toContain("Наследие Предательства");
    expect(card()).toContain("Напарник");
  });
});
