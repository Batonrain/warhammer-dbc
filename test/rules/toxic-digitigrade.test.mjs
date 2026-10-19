// test/rules/toxic-digitigrade.test.mjs
//
// wdbc-ird9n. Toxic (X): «Его естественное оружие получает свойство Toxic (X)»;
// Digitigrade (X): «+Х к SPD пешком и +5×Х на тесты Группирования».
// Фикстуры — настоящие документы packs-src, иначе зелёный тест не доказал бы,
// что запись едет с Чертой.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { weaponPropsFromRules } from "../../module/rules/resolve-test.mjs";
import { mechFormulaTotal } from "../../module/rules/mech-formula.mjs";
import { digitigradeRating, digitigradeGroupingBonus } from "../../module/rules/digitigrade.mjs";
import { _resolveFallDamage } from "../../module/combat/movement-actions.mjs";

const TOXIC = packDocById("packs-src/traits", "MSb7CEndj6xoMwzm");
const DIGI = packDocById("packs-src/traits", "fhVhZ7K5XS77irv9");

/** Черта «на акторе» с заданным рейтингом (как дропнутая копия). */
const trait = (doc, rating) => ({
  id: `i-${doc._id}`, name: doc.name, type: "trait", flags: doc.flags,
  system: { ...doc.system, rating },
  getFlag: (s, k) => doc.flags?.[s]?.[k]
});

describe("Токсичный (X) → Toxic (X) естественному оружию", () => {
  it("безоружная/естественная атака получает Toxic с рейтингом самой Черты", () => {
    for (const x of [1, 3]) {
      const rules = rulesFromItemMechanics([trait(TOXIC, x)]);
      expect(weaponPropsFromRules(rules, { kind: "attack", isMelee: true, unarmed: true }))
        .toEqual([expect.objectContaining({ key: "toxic", rating: x })]);
    }
  });
  it("атака обычным оружием — нет", () => {
    const rules = rulesFromItemMechanics([trait(TOXIC, 3)]);
    expect(weaponPropsFromRules(rules, { kind: "attack", isMelee: true, unarmed: false })).toEqual([]);
  });
});

describe("Двусоставный (X)", () => {
  it("запись Движения: +X к SPD — формула «rating» считает рейтинг Черты", () => {
    const entry = DIGI.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(e => e.kind === "movement");
    expect(entry).toMatchObject({ movementTarget: "spd", movementValue: "rating", op: "add" });
    expect(mechFormulaTotal(entry.movementValue, { rating: 2 })).toBe(2);
    expect(mechFormulaTotal("rating*2", { rating: 3 })).toBe(6);
  });

  it("+5×X на Группирование", () => {
    const a = { items: [trait(DIGI, 2)] };
    expect(digitigradeRating(a)).toBe(2);
    expect(digitigradeGroupingBonus(a)).toBe(10);
    expect(digitigradeGroupingBonus({ items: [] })).toBe(0);
  });

  describe("в окне Падения", () => {
    beforeEach(() => { resetCaptured(); });
    const actor = digi => ({
      name: "Зверолюд", items: digi ? [trait(DIGI, 1)] : [], updates: [],
      system: { characteristics: { ag: { total: 40 } }, skills: { acrobatics: { total: 30 } }, conditions: {} },
      async update(d) { this.updates.push(d); }
    });
    it("порог Группирования выше на +5×X и карточка это пишет", async () => {
      captured.dice = [5, 33];
      await _resolveFallDamage(actor(true), 4, { tuck: true });
      const html = captured.chat.at(-1).content;
      expect(html).toContain("Двусоставный +5");
      expect(html).toContain("Acrobatics 35");
      expect(html).toContain("Успех"); // 33 ≤ 35
    });
    it("без Черты порог обычный, 33 — провал", async () => {
      captured.dice = [5, 33];
      await _resolveFallDamage(actor(false), 4, { tuck: true });
      const html = captured.chat.at(-1).content;
      expect(html).not.toContain("Двусоставный");
      expect(html).toContain("Провал");
    });
  });
});
