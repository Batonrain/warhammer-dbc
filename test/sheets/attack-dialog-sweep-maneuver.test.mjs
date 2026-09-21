// test/sheets/attack-dialog-sweep-maneuver.test.mjs
//
// Приём Широкий Взмах (стр. 14, wdbc-x1nz.2.66.1): «не может быть
// Избирательной атакой» — раньше выбор части тела оставался доступен при
// любом выбранном Приёме. Тот же механизм форсированного select #atk-aim,
// что у Оглушить (attack-dialog.mjs::forcedAimValue/aimLocked), только цель —
// «— Без прицела —» вместо «Голова».

import { describe, it, expect } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function attacker({ items = [], ...system } = {}) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", ...system });
  a.update = async () => {};
  return a;
}

describe("Приём Широкий Взмах: окно форсирует «без Избирательной атаки»", () => {
  it("окно открыто с предустановленным Приёмом «Широкий Взмах» — select #atk-aim задизейблен, «Без прицела» выбрана", () => {
    const sword = weaponFor({ weaponClass: "melee" }, { name: "Меч" });
    resetCaptured();
    showAttackDialog(attacker({ items: [sword] }), sword, { technique: "sweep" });
    const html = captured.dialog.content;
    expect(html).toMatch(/<select id="atk-aim" class="av-input av-wide" disabled>/);
    expect(html).toMatch(/<option value=""[^>]*selected>/);
  });

  it("Обычная Атака — select #atk-aim обычный, не задизейблен", () => {
    const sword = weaponFor({ weaponClass: "melee" }, { name: "Меч" });
    resetCaptured();
    showAttackDialog(attacker({ items: [sword] }), sword);
    const html = captured.dialog.content;
    expect(html).toMatch(/<select id="atk-aim" class="av-input av-wide">/);
    expect(html).not.toMatch(/<select id="atk-aim"[^>]*disabled/);
  });
});
