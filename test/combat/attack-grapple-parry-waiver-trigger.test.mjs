// test/combat/attack-grapple-parry-waiver-trigger.test.mjs
//
// Захват (стр. 12, wdbc-x1nz.2.66.13): attack.mjs должен вычислить
// pool.canWaiveGrappleParry (isMelee && technique==="grapple" && банк ≥3)
// и довезти его до карточки — сквозная проверка через настоящий
// _executeAttackRoll, банк проставлен заранее (тот же банк, что оставила бы
// предыдущая атака этого же противника в этом Ходу).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { addEvasionSurplus } from "../../module/combat/evasion-pool.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
});

describe("Захват: банк ≥3 у цели — карточка несёт альтернативную кнопку Парирования", () => {
  it("цель уже накопила 3+ Успехов против этого атакующего — кнопка есть", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Кулаки" });
    const attacker = actorFor({ items: [weapon] });
    attacker.uuid = "Actor.attacker";
    const target = actorFor({});
    target.uuid = "Actor.target";
    target.getFlag = function (scope, key) { return this._flags?.[key]; };
    target.setFlag = async function (scope, key, value) { (this._flags ??= {})[key] = value; };
    await addEvasionSurplus(target, attacker.uuid, 3, 0);
    setTargets([target]);

    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "ws", 45, "melee", null, { techniqueOpts: { technique: "grapple" } });

    expect(card()).toContain("wh-pool-grapple-parry-btn");
  });

  it("цель не накопила банка (0 Успехов) — кнопки нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Кулаки" });
    const attacker = actorFor({ items: [weapon] });
    attacker.uuid = "Actor.attacker";
    const target = actorFor({});
    target.uuid = "Actor.target";
    target.getFlag = () => undefined;
    target.setFlag = async () => {};
    setTargets([target]);

    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "ws", 45, "melee", null, { techniqueOpts: { technique: "grapple" } });

    expect(card()).not.toContain("wh-pool-grapple-parry-btn");
  });

  it("тот же банк 3+, но НЕ Захват (Обычная Атака) — кнопки нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Кулаки" });
    const attacker = actorFor({ items: [weapon] });
    attacker.uuid = "Actor.attacker";
    const target = actorFor({});
    target.uuid = "Actor.target";
    target.getFlag = function (scope, key) { return this._flags?.[key]; };
    target.setFlag = async function (scope, key, value) { (this._flags ??= {})[key] = value; };
    await addEvasionSurplus(target, attacker.uuid, 3, 0);
    setTargets([target]);

    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "ws", 45, "melee", null, {});

    expect(card()).not.toContain("wh-pool-grapple-parry-btn");
  });
});
