// test/combat/focus-fire-suppressed.test.mjs
//
// Рисовка: пока действует запрет Командования, метка «Концентрация Огня» атакующего не работает
// (+2 куба урона). Метка без запрета — работает (контроль).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

let prevCombat;
beforeEach(() => { resetCaptured(); setTargets([]); prevCombat = game.combat; game.combat = { id: "cb", round: 3 }; });
afterEach(() => { game.combat = prevCombat; });

async function swing(flags) {
  const w = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" }, { name: "Меч" });
  const actor = actorFor({ items: [w], characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) } });
  actor.getFlag = (s, k) => flags[k];
  captured.dice = [10, 5, 5, 5, 5, 5, 5, 5];
  await _executeAttackRoll(actor, w, "ws", 45, "melee", null, { baseKey: "standard" });
  return captured.chat.at(-1)?.content ?? "";
}
const damageOf = html => Number(/data-damage="(\d+)"/.exec(html)?.[1]);

describe("Концентрация Огня и запрет Командования", () => {
  const focus = { weaponName: "Меч", with: [] };
  it("контроль: метка без запрета даёт больше урона, чем атака без метки", async () => {
    const plain = damageOf(await swing({}));
    resetCaptured();
    const boosted = damageOf(await swing({ focusFire: focus }));
    expect(boosted).toBeGreaterThan(plain);
  });
  it("с запретом Командования метка не работает — урон как без метки", async () => {
    const plain = damageOf(await swing({}));
    resetCaptured();
    const suppressed = damageOf(await swing({ focusFire: focus, commandSuppressed: { giverUuid: "Actor.x", combatId: "cb", round: 3 } }));
    expect(suppressed).toBe(plain);
  });
  it("запрет прошлого боя — метка снова работает", async () => {
    const plain = damageOf(await swing({}));
    resetCaptured();
    const old = damageOf(await swing({ focusFire: focus, commandSuppressed: { giverUuid: "Actor.x", combatId: "old", round: 3 } }));
    expect(old).toBeGreaterThan(plain);
  });
});
