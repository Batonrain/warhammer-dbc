// test/combat/attack-imperative-dodge.test.mjs
//
// wdbc-yu32: активный Императив цели (module/rules/imperative.mjs) добавляет
// плоский бонус/штраф к dodgeMod карточки атаки — суммируется с базовым
// модификатором Карабина/рукопашной стрельбы (wdbc-z56a), не заменяет его.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
function dodgeExtraMod() {
  const m = card().match(/wh-dodge-btn"[^>]*data-extra-mod="(-?\d+)"/);
  return m ? Number(m[1]) : null;
}

/** Актор с активным носителем Императива (тем же флагом, что module/rules/imperative.mjs). */
function imperativeCarrier(bonuses) {
  return { id: "carrier", type: "trait", getFlag: (s, k) => (k === "imperativeCarrier" ? true : k === "imperativeBonuses" ? bonuses : undefined) };
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Императив цели (wdbc-yu32): бонус/штраф к Уклонению в карточке атаки", () => {
  it("нет активного Императива у цели — бонус 0", async () => {
    const weapon = weaponFor();
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor();
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});
    expect(dodgeExtraMod()).toBe(0);
  });

  it("Императив Избегания активен у цели — +30 к Уклонению", async () => {
    const weapon = weaponFor();
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor({ items: [imperativeCarrier({ evasionBonus: 30 })] });
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});
    expect(dodgeExtraMod()).toBe(30);
  });

  it("Императив Крепости активен у цели — суммируется со штрафом от рукопашной стрельбы Карабином", async () => {
    const weapon = weaponFor({ weaponProps: [{ key: "carbine" }] });
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor({ items: [imperativeCarrier({ evasionBonus: -30 })] });
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, { meleeShot: true });
    expect(dodgeExtraMod()).toBe(-20); // Карабин +10, Императив −30 → −20
  });
});
