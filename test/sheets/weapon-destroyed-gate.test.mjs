// test/sheets/weapon-destroyed-gate.test.mjs
//
// «Уничтожено» (system.destroyed) — цена Кровавого Пламени по книге: «по
// окончании боя оружие ломается и бесполезно, пока не будет починено».
//
// Поле считается для ОБОИХ списков оружия (sheet-helpers.mjs::makeCombatWeapon
// — там нет гейта !melee, в отличие от jammed/needsRecharge), но кнопку
// «Атака» блокировала только строка ДАЛЬНЕГО боя. Между тем все три источника
// system.destroyed в системе — рукопашные: Кровавое Пламя (combat/blood-
// flame.mjs, только melee/thrown), Огрин, ломающий человеческое оружие в
// рукопашной, и Reformation Song. То есть гейт стоял ровно там, где никогда не
// понадобится, и отсутствовал там, где он единственно нужен: сломанный топор
// выглядел целым, «Атака» жалась, Дар оставался без обратной стороны.

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

const hbs = fs.readFileSync(path.resolve(import.meta.dirname,
  "../../templates/actor/parts/tab-combat.hbs"), "utf8");

/** Разметка одной секции боевого оружия — от её панели до следующей. */
function section(collapseKey, nextCollapseKey) {
  const start = hbs.indexOf(`data-collapse-key="${collapseKey}"`);
  const end   = hbs.indexOf(`data-collapse-key="${nextCollapseKey}"`, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return hbs.slice(start, end);
}

describe("Уничтоженное оружие: кнопка «Атака» заблокирована в обоих списках", () => {
  const melee = section("combat-melee", "combat-ranged");

  it("ближний бой: кнопка «Атака» гейтится по w.destroyed", () => {
    const btn = melee.slice(melee.indexOf("weapon-attack-roll combat-atk-btn"));
    const tag = btn.slice(0, btn.indexOf(">Атака</button>"));
    expect(tag).toContain("w.destroyed");
    expect(tag).toContain("disabled");
  });

  it("ближний бой: бейдж «💥 Уничтожено» виден игроку", () => {
    expect(melee).toContain("💥 Уничтожено");
  });

  it("дальний бой: гейт на месте (не сломан этой правкой)", () => {
    const ranged = hbs.slice(hbs.indexOf('data-collapse-key="combat-ranged"'));
    const btn = ranged.slice(ranged.indexOf("weapon-attack-roll rwc-atk-btn"));
    const tag = btn.slice(0, btn.indexOf(">Атака</button>"));
    expect(tag).toContain("w.destroyed");
    expect(tag).toContain("disabled");
  });
});
