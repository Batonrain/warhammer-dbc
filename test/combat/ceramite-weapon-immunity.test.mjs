// test/combat/ceramite-weapon-immunity.test.mjs
//
// wdbc-nquc: Керамит (DoomBC IV. Арсенал, стр. 231) даёт «+3 AP против E(Fl)
// Dmg и иммунитет к свойствам Deflagrate или Melta». +3 AP уже был смоделирован
// ActiveEffect'ом (absorption.vsSubtype.flame, wdbc-q0q8) — здесь проверяется
// вторая половина, иммунитет к самим СВОЙСТВАМ ОРУЖИЯ: capability
// weaponPropertyImmunity.deflagrate/.melta (module/constants/capabilities.mjs),
// читается hasWeaponPropertyImmunity() прямо в combat/attack.mjs, потому что
// оба свойства запекаются в сам бросок атаки (доп. кубик Выгорания, удвоение
// Пробития Мельты), а не в отдельном "rating"-поле, применяемом позже в
// combat/damage.mjs, как Corrosive/Piercing/Crippling/Haywire.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const penetration = () => {
  const m = card().match(/Пробитие (-?\d+)/);
  return m ? Number(m[1]) : null;
};
const hitDamage = () => {
  const m = card().match(/roll-hit-dmg">(-?\d+)</);
  return m ? Number(m[1]) : null;
};

/**
 * Цель с Керамитом: несёт запись Конструктора kind:"capability" ровно так,
 * как её пишет вкладка МЕХАНИКА (см. packs-src/armor-mods/Укрепление/
 * Керамит_d13eDPB3xskVF5sW.json) — тот же приём фикстуры, что и в
 * test/combat/weapon-property-effects.test.mjs::characterActor.
 */
function ceramiteDefender(...propKeys) {
  const item = {
    id: "ceramite-test", name: "Керамит (тест)", type: "mutation", system: {},
    flags: { "warhammer-dbc": { mechanics: [{
      id: "g", operator: "AND",
      entries: propKeys.map((key, i) => ({
        id: `e${i}`, kind: "capability", capabilityKey: `weaponPropertyImmunity.${key}`, label: ""
      }))
    }] } }
  };
  return actorFor({ items: [item] });
}

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("Керамит: иммунитет к свойству оружия Deflagrate (wdbc-nquc)", () => {
  function deflagrateWeapon(overrides = {}) {
    const w = weaponFor({
      weaponClass: "basic", damage: "1d10+5", damageType: "E", penetration: 4,
      weaponProps: [{ key: "deflagrate", rating: 4 }], ...overrides
    });
    w.type = "weapon";
    return w;
  }

  it("без Керамита — куб урона 7+ даёт доп. энерг. урон Выгорания", async () => {
    const weapon = deflagrateWeapon();
    const actor  = actorFor({ items: [weapon] });
    setTargets([]); // цель без иммунитета
    // d100 (попадание), d10 урона (8, ≥7 — триггерит Выгорание), d10 Выгорания (5).
    captured.dice = [10, 8, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("выгор.");
    expect(hitDamage()).toBe(8 + 5 + 5 + 4); // база (8+5) + довесок Выгорания (5+4)
  });

  it("цель с Керамитом — доп. кубик Выгорания не бросается вовсе", async () => {
    const weapon   = deflagrateWeapon();
    const attacker = actorFor({ items: [weapon] });
    setTargets([ceramiteDefender("deflagrate")]);
    // Тот же куб урона (8, ≥7) — но третий бросок Выгорания цель гасит,
    // очередь кубов не тронута сверх двух первых.
    captured.dice = [10, 8];

    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("выгор.");
    expect(hitDamage()).toBe(8 + 5); // только база, без довеска
  });

  it("иммунитет по чужому ключу (melta) Deflagrate не гасит", async () => {
    const weapon   = deflagrateWeapon();
    const attacker = actorFor({ items: [weapon] });
    setTargets([ceramiteDefender("melta")]);
    captured.dice = [10, 8, 5];

    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("выгор.");
    expect(hitDamage()).toBe(8 + 5 + 5 + 4);
  });
});

describe("Керамит: иммунитет к свойству оружия Melta (wdbc-nquc)", () => {
  function meltaWeapon(overrides = {}) {
    const w = weaponFor({
      weaponClass: "basic", damage: "1d10+5", damageType: "E", penetration: 6,
      weaponProps: [{ key: "melta" }], ...overrides
    });
    w.type = "weapon";
    return w;
  }

  it("без Керамита, в упор — Мельта удваивает Пробитие", async () => {
    const weapon = meltaWeapon();
    const actor  = actorFor({ items: [weapon] });
    setTargets([]);
    captured.dice = [10, 6]; // d100 атаки, d10 урона

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { shortRange: true });

    expect(penetration()).toBe(12); // база 6 × 2
  });

  it("цель с Керамитом, в упор — Пробитие остаётся базовым", async () => {
    const weapon   = meltaWeapon();
    const attacker = actorFor({ items: [weapon] });
    setTargets([ceramiteDefender("melta")]);
    captured.dice = [10, 6];

    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, { shortRange: true });

    expect(penetration()).toBe(6); // без удвоения
  });

  it("цель с Керамитом, но НЕ в упор — вопрос неприменим (Мельта и так не удваивает)", async () => {
    const weapon   = meltaWeapon();
    const attacker = actorFor({ items: [weapon] });
    setTargets([ceramiteDefender("melta")]);
    captured.dice = [10, 6];

    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, { shortRange: false });

    expect(penetration()).toBe(6);
  });

  it("Керамит несёт ОБА иммунитета сразу — Deflagrate и Melta гасятся одной и той же целью", async () => {
    const weapon = weaponFor({
      weaponClass: "basic", damage: "1d10+5", damageType: "E", penetration: 6,
      weaponProps: [{ key: "melta" }, { key: "deflagrate", rating: 4 }]
    });
    weapon.type = "weapon";
    const attacker = actorFor({ items: [weapon] });
    // Ровно та запись, которую несёт packs-src/armor-mods/Укрепление/Керамит:
    // одна И-группа с двумя capability-записями.
    setTargets([ceramiteDefender("deflagrate", "melta")]);
    captured.dice = [10, 8]; // d100, d10 урона (8, ≥7 — Выгорание было бы, если б не иммунитет)

    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, { shortRange: true });

    expect(penetration()).toBe(6);       // Мельта не удвоила
    expect(card()).not.toContain("выгор."); // Выгорание не добавило кубик
    expect(hitDamage()).toBe(8 + 5);
  });
});
