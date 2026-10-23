// test/combat/attack-thrown-weapon.test.mjs
//
// Стр. 40, wdbc-x1nz.2.58: Метательное оружие — «+S.b к урону» даже брошенным
// (не только в рукопашной), и «При Критическом Промахе... не Заклинивает»
// (общий механизм Заклинивания по Надёжности его не касается вовсе).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Метательное оружие: +S.b к урону при броске (wdbc-x1nz.2.58)", () => {
  it("брошено (не рукопашная) — урон включает S.b", async () => {
    const weapon = weaponFor({ weaponClass: "thrown", damage: "1d10", rof_single: 1 });
    const actor  = actorFor({ items: [weapon], characteristics: { s: { total: 40, bonus: 4 } } });
    captured.dice = [10, 5]; // атака: rv=10 (попадание, Порог 45); урон: 1d10=5

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain('data-damage="9"'); // 5 + S.b 4
  });

  it("обычное стрелковое (basic) — S.b НЕ добавляется брошенным путём", async () => {
    const weapon = weaponFor({ weaponClass: "basic", damage: "1d10", rof_single: 1 });
    const actor  = actorFor({ items: [weapon], characteristics: { s: { total: 40, bonus: 4 } } });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain('data-damage="5"');
  });
});

// Balearic / Балеарец (3-8318, стр. 108): «добавляет ½A.b (окр.▲) к S.b в
// расчёте дальности и урона метательного…» — здесь только урон; дальность
// (S.b×3 м) и «примитивное стрелковое» не трогаем (в системе S.b к урону
// получает только класс «thrown»).
describe("Метательное оружие: Балеарец — +½A.b (окр.▲) к S.b урона (3-8318)", () => {
  const grantBalearic = () => registerRuleSource("test-balearic", () => [
    { id: "balearic", effects: [{ kind: "grantFlag", target: "throwing.core.balearic" }] }]);
  const chars = ab => ({ s: { total: 40, bonus: 4 }, ag: { total: ab * 10, bonus: ab } });
  const DEFAULT_SOURCES = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
  });

  it("A.b 5 → +3 (½ от 5 вверх): 5 + S.b 4 + 3 = 12", async () => {
    grantBalearic();
    const weapon = weaponFor({ weaponClass: "thrown", damage: "1d10", rof_single: 1 });
    const actor  = actorFor({ items: [weapon], characteristics: chars(5) });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain('data-damage="12"');
  });

  it("A.b 4 → +2: 5 + 4 + 2 = 11", async () => {
    grantBalearic();
    const weapon = weaponFor({ weaponClass: "thrown", damage: "1d10", rof_single: 1 });
    const actor  = actorFor({ items: [weapon], characteristics: chars(4) });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain('data-damage="11"');
  });

  it("без Таланта — прежние 5 + S.b 4 = 9", async () => {
    const weapon = weaponFor({ weaponClass: "thrown", damage: "1d10", rof_single: 1 });
    const actor  = actorFor({ items: [weapon], characteristics: chars(5) });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain('data-damage="9"');
  });

  it("обычное стрелковое с Талантом — ни S.b, ни Балеарец не добавляются", async () => {
    grantBalearic();
    const weapon = weaponFor({ weaponClass: "basic", damage: "1d10", rof_single: 1 });
    const actor  = actorFor({ items: [weapon], characteristics: chars(5) });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain('data-damage="5"');
  });
});

describe("Метательное оружие: не Заклинивает (wdbc-x1nz.2.58)", () => {
  it("Ненадёжное метательное, высокий бросок урона — не клинит", async () => {
    const weapon = weaponFor({
      weaponClass: "thrown", damage: "1d10", rof_single: 1,
      weaponProps: [{ key: "unreliable" }]
    });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [95, 5]; // rv=95 — попало бы в порог клина Ненадёжного (91+) у обычного стрелкового

    await _executeAttackRoll(actor, weapon, "bs", 96, "single", null, {});

    expect(weapon.system.jammed).toBe(false);
  });

  it("то же Ненадёжное, но обычное стрелковое — клинит на том же броске", async () => {
    const weapon = weaponFor({
      weaponClass: "basic", damage: "1d10", rof_single: 1,
      weaponProps: [{ key: "unreliable" }]
    });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [95, 5];

    await _executeAttackRoll(actor, weapon, "bs", 96, "single", null, {});

    expect(weapon.system.jammed).toBe(true);
  });
});
