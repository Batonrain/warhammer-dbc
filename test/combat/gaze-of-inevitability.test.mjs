// test/combat/gaze-of-inevitability.test.mjs
//
// Gaze of Inevitability / Взор Неизбежности (Дар Нургла, wdbc-1rno.3) —
// пассивная половина: «Противники, что могут видеть глаза персонажа...,
// должны комбинировать любой тест на Избегание ОТ ЕГО АТАК с тестом на
// W−10. Если они проваливают этот тест, они теряют все свои Реакции.»
// Только когда носитель Дара — АТАКУЮЩИЙ (attackerActor), не любое
// Избегание вообще (активная половина, W−30 на одну цель, уже реализована
// отдельно, здесь не участвует).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { _performDodge, _performParry } from "../../module/combat/defense.mjs";

function gazeItem() {
  return { id: "gaze-1", type: "mutation", name: "Gaze of Inevitability / Взор Неизбежности", system: {} };
}

function withToken(actorObj, { x = 0, y = 0, rotation = 0, sight } = {}) {
  return { id: actorObj.id, actor: actorObj, x, y, width: 1, height: 1, rotation, ...(sight ? { sight } : {}) };
}

function equippedMelee(overrides = {}) {
  const w = weaponFor({ weaponClass: "melee", balance: 0, equipped: true, ...overrides });
  w.type = "weapon";
  return w;
}

/** actorFor() не даёт actor.update() — здесь он нужен для проверки обнуления Реакций. */
function withUpdate(actorObj) {
  actorObj.update = async (changes = {}) => {
    for (const [path, value] of Object.entries(changes)) {
      const keys = path.split(".");
      let node = actorObj;
      for (const key of keys.slice(0, -1)) node = (node[key] ??= {});
      node[keys.at(-1)] = value;
    }
    return actorObj;
  };
  return actorObj;
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
  globalThis.canvas = { tokens: { placeables: [] } };
});

function setupPair({ ag = 45, wp = 40, weaponItems = [], gazeOnAttacker = true, sightOverride } = {}) {
  const defender = actorFor({ items: weaponItems, characteristics: { ws: { total: 45 }, ag: { total: ag }, wp: { total: wp } },
    reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 } });
  defender.uuid = "Actor.defender-1";
  defender.getFlag = () => undefined;
  defender.setFlag = async () => {};
  withUpdate(defender);
  const attackerItems = gazeOnAttacker ? [gazeItem()] : [];
  const attacker = actorFor({ items: attackerItems });
  attacker.uuid = "Actor.attacker-1";
  globalThis.fromUuid = async uuid => ({ "Actor.attacker-1": attacker }[uuid] ?? null);
  globalThis.canvas.tokens.placeables = [
    withToken(defender, { x: 0, y: 0, rotation: 0, sight: sightOverride }),
    withToken(attacker, { x: 0, y: -300 }) // атакующий в поле зрения защищающегося по умолчанию (0° сектор смотрит вверх)
  ];
  return { defender, attacker };
}

describe("_performDodge: Взор Неизбежности", () => {
  it("защищающийся видит глаза атакующего-носителя, комбинированный тест провален (W-10 ниже) — все Реакции потеряны", async () => {
    // Ag 45 сам по себе прошёл бы 30, но W-10=30 тоже — оба провалены при rv=35.
    const { defender } = setupPair({ ag: 90, wp: 40 }); // Ag-порог 90, W-10-порог 30 → комбинированный 30
    captured.dice = [35]; // >30 (комбинированный), но <90 (голый Ag) — провал ТОЛЬКО из-за комбинирования
    await _performDodge(defender, { attackerUuid: "Actor.attacker-1" });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Взор Неизбежности");
    expect(card).toContain("Уклонение провалено");
    expect(defender.system.reactions.value).toBe(0);
    expect(defender.system.reactions.defenseValue).toBe(0);
  });

  it("комбинированный тест пройден — Реакции не трогаются, заметки в карточке нет провала", async () => {
    const { defender } = setupPair({ ag: 90, wp: 40 });
    captured.dice = [20]; // ≤30 (оба порога) — успех
    await _performDodge(defender, { attackerUuid: "Actor.attacker-1" });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Уклонение успешно");
    expect(defender.system.reactions.value).toBe(1); // Реакция уже потрачена spendReaction, но не обнулена сверх
  });

  it("атакующий БЕЗ Дара — обычный тест, никакого упоминания Взора Неизбежности", async () => {
    const { defender } = setupPair({ ag: 45, wp: 40, gazeOnAttacker: false });
    captured.dice = [90];
    await _performDodge(defender, { attackerUuid: "Actor.attacker-1" });
    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("Взор Неизбежности");
  });

  it("защищающийся НЕ видит атакующего (сектор обзора не покрывает) — обычный тест, без комбинирования", async () => {
    const defender = actorFor({ characteristics: { ag: { total: 90 }, wp: { total: 40 } },
      reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 } });
    defender.uuid = "Actor.defender-1";
    defender.getFlag = () => undefined; defender.setFlag = async () => {};
    const attacker = actorFor({ items: [gazeItem()] });
    attacker.uuid = "Actor.attacker-1";
    globalThis.fromUuid = async uuid => ({ "Actor.attacker-1": attacker }[uuid] ?? null);
    // Защищающийся смотрит на север (rotation 0, сектор 210 по умолчанию), атакующий строго сзади (юг).
    globalThis.canvas.tokens.placeables = [
      withToken(defender, { x: 0, y: 0, rotation: 0, sight: { angle: 210 } }),
      withToken(attacker, { x: 0, y: 300 })
    ];
    captured.dice = [50]; // провалил бы комбинированный W-10=30, но эффект не должен сработать вовсе
    await _performDodge(defender, { attackerUuid: "Actor.attacker-1" });
    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("Взор Неизбежности");
  });
});

describe("_performParry: Взор Неизбежности", () => {
  it("защищающийся видит глаза атакующего-носителя, провал — все Реакции потеряны", async () => {
    const sword = equippedMelee();
    const { defender } = setupPair({ weaponItems: [sword], wp: 40 });
    defender.system.characteristics.ws = { total: 90 }; // WS-порог 90, W-10=30 → комбинированный 30
    captured.dice = [35];
    await _performParry(defender, { attackerUuid: "Actor.attacker-1" });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Взор Неизбежности");
    expect(card).toContain("Парирование провалено");
    expect(defender.system.reactions.value).toBe(0);
  });
});
