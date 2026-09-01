// test/combat/attack-carbine-dodge.test.mjs
//
// wdbc-z56a: «Винтовка» в рукопашной даёт цели +30 на Уклонение вместо +30,
// Карабин снижает это до +10 (стр. 40). Диалог атаки не различает типы
// стрелкового оружия (Пистолет/Винтовка/Тяжёлое) нигде — тот же штраф −20
// «Стрельба в рукопашную» уже применяется единообразно ко всем, поэтому и
// бонус цели считается так же: есть галочка «Стрельба в рукопашную» → бонус,
// Карабин снижает его, а не тип оружия.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
function dodgeExtraMod() {
  const m = card().match(/wh-dodge-btn"[^>]*data-extra-mod="(-?\d+)"/);
  return m ? Number(m[1]) : null;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Карабин: бонус Уклонения цели при стрельбе в рукопашную", () => {
  it("выстрел не в рукопашную — бонуса нет", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(dodgeExtraMod()).toBe(0);
  });

  it("выстрел в рукопашную обычным оружием — цель получает +30", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { meleeShot: true });
    expect(dodgeExtraMod()).toBe(30);
  });

  it("Карабин в рукопашную — цель получает только +10", async () => {
    const weapon = weaponFor({ weaponProps: [{ key: "carbine" }] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { meleeShot: true });
    expect(dodgeExtraMod()).toBe(10);
  });
});
