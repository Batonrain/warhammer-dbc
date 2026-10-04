// test/apps/elite-gear.test.mjs
//
// Снаряжение Элитного Архетипа при покупке (стр. 24: «стартовое снаряжение от
// Расы, Архетипа и возможных Элитных Архетипов»). Проверяется разбор текста:
// что выдаётся само, что уже на листе, что остаётся ГМу. Создание предметов и
// шёпот проверяют живьём.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { planEliteGear, hasEquipmentMechanics } from "../../module/apps/gear-grant.mjs";

/** Компендиум из двух имён: Ghostplate Armor и Shrieker. */
const find = spec => /ghostplate|shrieker/i.test(spec.name ?? "")
  ? { pack: {}, id: spec.name, name: spec.name } : null;

describe("planEliteGear", () => {
  it("именной предмет, найденный в компендиуме, выдаётся сам", () => {
    const plan = planEliteGear("Ghostplate Armor", { find });
    expect(plan.grant.map(g => g.spec.name)).toEqual(["Ghostplate Armor"]);
    expect(plan.manual).toEqual([]);
  });

  it("выбор «или» остаётся игроку — Обозреватель посреди покупки не открывается", () => {
    const plan = planEliteGear("Ghostplate Armor; Splinter Cannon или Shredder, или Blaster", { find });
    expect(plan.grant.map(g => g.spec.name)).toEqual(["Ghostplate Armor"]);
    expect(plan.manual).toHaveLength(1);
    expect(plan.manual[0]).toContain("выбрать:");
    expect(plan.manual[0]).toContain("Splinter Cannon");
  });

  it("категория «до R3» — тоже ГМу: выдать само нельзя", () => {
    const plan = planEliteGear("Power Weapon (Good.Q, до R3)", { find });
    expect(plan.grant).toEqual([]);
    expect(plan.manual).toHaveLength(1);
  });

  it("то, что уже лежит на листе, второй раз не выдаётся", () => {
    const plan = planEliteGear("Shrieker; Ghostplate Armor", { find, owned: new Set(["shrieker"]) });
    expect(plan.skipped).toEqual(["Shrieker"]);
    expect(plan.grant.map(g => g.spec.name)).toEqual(["Ghostplate Armor"]);
  });

  it("имя не найдено — строка для ГМа, а не молчаливая потеря", () => {
    const plan = planEliteGear("Unknown Blaster Of Doom", { find });
    expect(plan.grant).toEqual([]);
    expect(plan.manual[0]).toContain("не найдено в компендиумах");
  });

  it("пустой текст — нечего выдавать", () => {
    for (const text of ["", "   ", undefined, null]) {
      expect(planEliteGear(text, { find })).toEqual({ grant: [], skipped: [], manual: [] });
    }
  });
});

describe("hasEquipmentMechanics", () => {
  const withMech = entries => ({ flags: { "warhammer-dbc": { mechanics: [{ entries }] } } });

  it("запись Конструктора «Снаряжение» — Механика выдаёт сама, текст не дублируем", () => {
    expect(hasEquipmentMechanics(withMech([{ kind: "equipment" }]))).toBe(true);
  });

  it("другие записи Конструктора и их отсутствие — текст выдаём", () => {
    expect(hasEquipmentMechanics(withMech([{ kind: "trait" }]))).toBe(false);
    expect(hasEquipmentMechanics({})).toBe(false);
    expect(hasEquipmentMechanics(null)).toBe(false);
  });
});
