// test/combat/fall-damage-apply.test.mjs
//
// wdbc-eyd1l. Падение (стр. 30): «Урон от падения игнорирует броню»,
// Стойкость поглощает (решение владельца 01.10.2026), подвид — обычный I без
// (Cr), Пустые Кости Гарпии не действуют; «после получения урона от падения
// персонаж становится Лежачим».

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { _resolveFallDamage } from "../../module/combat/movement-actions.mjs";
import { fallDamageSectionHtml } from "../../module/combat/fall-damage.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function faller() {
  const updates = [];
  return {
    name: "Падающий", items: [], updates,
    system: { characteristics: { ag: { total: 40 } }, conditions: {} },
    async update(d) { updates.push(d); }
  };
}

beforeEach(resetCaptured);

describe("кнопка урона падения", () => {
  it("несёт ignore-armour, обычный I без подвида и место Торс", () => {
    const html = fallDamageSectionHtml(12, "Падение");
    expect(html).toContain('data-ignore-armour="1"');
    expect(html).toContain('data-damage="12"');
    expect(html).toContain('data-damage-type="impact"');
    expect(html).not.toContain("data-damage-subtype");
  });
});

describe("_resolveFallDamage: применение урона и Лежачий", () => {
  it("есть урон — карточка с кнопкой, персонаж Лежачий", async () => {
    const a = faller();
    captured.dice = [5]; // 1d10
    await _resolveFallDamage(a, 3);
    const html = captured.chat.at(-1).content;
    expect(html).toContain('data-ignore-armour="1"');
    expect(html).toContain('data-damage="8"'); // 5 + 3
    expect(html).toContain("Стойкость поглощает");
    expect(a.updates.length).toBe(1);
    expect(JSON.stringify(a.updates[0])).toContain("prone");
  });

  it("приземлился на ноги без урона — ни кнопки, ни Лежачего", async () => {
    const a = faller();
    captured.dice = [10, 35]; // урон 10, Acrobatics 35≤40 → 1 успех > высоты 0
    await _resolveFallDamage(a, 0, { tuck: true });
    const html = captured.chat.at(-1).content;
    expect(html).not.toContain("wh-apply-dmg-btn");
    expect(a.updates.length).toBe(0);
  });
});

describe("applyDamageToActor: падение против брони, Стойкости и Пустых Костей", () => {
  const target = (armorAP, toughnessBonus) => {
    const t = {
      id: "t1", name: "Цель", type: "character",
      system: {
        absorption: { body: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
        wounds: { value: 20, critical: 0, max: 20 }
      },
      items: Object.assign([], { contents: [] }),
      async update(d) { if (d["system.wounds.value"] !== undefined) this.system.wounds.value = d["system.wounds.value"]; }
    };
    return t;
  };
  const fall = { rawDamage: 12, penetration: 0, damageType: "impact", ignoreArmour: true,
    hitLocation: "Торс", attackerName: "—", weaponName: "Падение" };

  it("броня 8 не гасит, Стойкость 3 гасит: 12 − 3 = 9 урона", async () => {
    const t = target(8, 3);
    await applyDamageToActor(t, fall);
    expect(t.system.wounds.value).toBe(11); // 20 − 9
  });
});
