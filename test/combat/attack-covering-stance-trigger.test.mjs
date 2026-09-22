// test/combat/attack-covering-stance-trigger.test.mjs
//
// Прикрывающая Стойка (стр. 15, wdbc-x1nz.2.66.7): «Когда противник в
// контакте атакует союзника персонажа, персонаж может совершить по нему
// свободную атаку» — проверяется через настоящий _executeAttackRoll: атака
// по цели, у которой рядом (Базовый контакт) союзник в Прикрывающей Стойке,
// должна отдельным сообщением предложить тому кнопку Свободной атаки.

const HOSTILE = -1, FRIENDLY = 1;

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const lastCard = () => captured.chat.at(-1)?.content ?? "";
const anyCardWith = text => captured.chat.some(c => c.content.includes(text));

let _tokenId = 0;
function tokenAt({ actor, x = 0, y = 0, disposition = HOSTILE, name = "T" }) {
  const id = `t${_tokenId++}`;
  return { actor, document: { id, x, y, width: 1, height: 1, disposition, actor, name, uuid: `Scene.s.Token.${id}` } };
}

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
  globalThis.game.combat = undefined; // hasActionEconomy — вне боя своя ветка, сверить обе
});

describe("Прикрывающая Стойка: атака по прикрытой цели предлагает прикрывающему Свободную атаку", () => {
  it("цель в Базовом контакте с союзником в Прикрывающей Стойке — второе сообщение предлагает кнопку", async () => {
    const weapon = weaponFor({ weaponClass: "melee", damage: "1d10" });
    const attackerActor = actorFor({ items: [weapon] });
    attackerActor.uuid = "Actor.attacker";
    const attackerToken = tokenAt({ actor: attackerActor, x: 50, y: 50, disposition: HOSTILE, name: "Атакующий" });
    // resolveAttackerToken (combat/facing.mjs) идёт через fromUuid(actor.uuid)
    // → actor.getActiveTokens(false, true), не напрямую через canvas — стенд
    // по умолчанию (foundry-stub.mjs) отдаёт null на любой fromUuid.
    globalThis.fromUuid = async uuid => (uuid === attackerActor.uuid ? attackerActor : null);

    const targetActor = { name: "Цель", type: "character", uuid: "Actor.target", system: { meleeStance: "standard" } };
    const targetToken = tokenAt({ actor: targetActor, x: 0, y: 0, disposition: FRIENDLY, name: "Цель" });

    const guardActor = {
      name: "Щитоносец", type: "character", uuid: "Actor.guard",
      system: { meleeStance: "covering", reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 } },
      items: [], getFlag: () => undefined, setFlag: async () => {}
    };
    const guardToken = tokenAt({ actor: guardActor, x: 1, y: 0, disposition: FRIENDLY, name: "Щитоносец" });

    globalThis.canvas.tokens.placeables = [attackerToken, targetToken, guardToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
    captured.dice = [10, 5, 32, 7]; // hit, locRoll, dmg

    await _executeAttackRoll(attackerActor, weapon, "ws", 45, "melee", null, {});

    expect(anyCardWith("Свободная атака")).toBe(true);
    expect(anyCardWith("Щитоносец")).toBe(true);
  });

  it("цель без прикрывающего союзника рядом — Свободная атака не предлагается", async () => {
    const weapon = weaponFor({ weaponClass: "melee", damage: "1d10" });
    const attackerActor = actorFor({ items: [weapon] });
    const attackerToken = tokenAt({ actor: attackerActor, x: 50, y: 50, disposition: HOSTILE, name: "Атакующий" });
    const targetActor = { name: "Цель", type: "character", uuid: "Actor.target", system: { meleeStance: "standard" } };
    const targetToken = tokenAt({ actor: targetActor, x: 0, y: 0, disposition: FRIENDLY, name: "Цель" });
    globalThis.canvas.tokens.placeables = [attackerToken, targetToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
    captured.dice = [10, 5, 32, 7];

    await _executeAttackRoll(attackerActor, weapon, "ws", 45, "melee", null, {});

    expect(anyCardWith("Свободная атака")).toBe(false);
  });

  it("прикрывающий союзник рядом, но без Реакции — Свободная атака не предлагается", async () => {
    const weapon = weaponFor({ weaponClass: "melee", damage: "1d10" });
    const attackerActor = actorFor({ items: [weapon] });
    const attackerToken = tokenAt({ actor: attackerActor, x: 50, y: 50, disposition: HOSTILE, name: "Атакующий" });
    const targetActor = { name: "Цель", type: "character", uuid: "Actor.target", system: { meleeStance: "standard" } };
    const targetToken = tokenAt({ actor: targetActor, x: 0, y: 0, disposition: FRIENDLY, name: "Цель" });
    const guardActor = {
      name: "Щитоносец", type: "character", uuid: "Actor.guard",
      system: { meleeStance: "covering", reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 0 } },
      items: [], getFlag: () => undefined, setFlag: async () => {}
    };
    const guardToken = tokenAt({ actor: guardActor, x: 1, y: 0, disposition: FRIENDLY, name: "Щитоносец" });
    globalThis.canvas.tokens.placeables = [attackerToken, targetToken, guardToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
    captured.dice = [10, 5, 32, 7];

    await _executeAttackRoll(attackerActor, weapon, "ws", 45, "melee", null, {});

    expect(anyCardWith("Свободная атака")).toBe(false);
  });
});
