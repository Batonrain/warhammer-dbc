// test/combat/defense-blade-shield-pen.test.mjs
//
// Щит Клинков / Blade Shield (Избегание, Sahara 62, п.3), решение владельца 24.10.2026
// (вариант 2): «Стрелковое оружие с Pen 6 и более считается имеющим свойство Power Field
// в расчете парирования» — такую стрельбу парирует только оружие с Power Field.
// Остальная стрельба парируется обычным клинком Баланса 1+ (см. defense.test.mjs).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _performParry } from "../../module/combat/defense.mjs";

const DEFAULT_SOURCES = getRuleSources();
const BLADE_SHIELD = "dodge.core.bladeShield";

function blade({ powerField = false } = {}) {
  const w = weaponFor({
    weaponClass: "melee", balance: 1, equipped: true,
    weaponProps: powerField ? [{ key: "powerField" }] : []
  });
  w.type = "weapon";
  return w;
}
function defender(items) {
  registerRuleSource("test-bs", () => [{ id: "bs", label: "Щит Клинков", effects: [{ kind: "grantFlag", target: BLADE_SHIELD }] }]);
  const a = actorFor({ items });
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  return a;
}

let prevFromUuid;
beforeEach(() => {
  resetCaptured();
  captured.dice = [10, 50];          // Парирование удаётся; второй куб — на Силовое поле
  globalThis.game.combat = undefined;
  prevFromUuid = globalThis.fromUuid;
});
afterEach(() => {
  globalThis.fromUuid = prevFromUuid;
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

/** Парирование стрельбы оружием с `pen` Pen: стрелок и его оружие резолвятся по uuid. */
async function parryShot({ pen, powerField = false }) {
  const gun = weaponFor({ weaponClass: "basic", penetration: pen, damage: "1d10+3" }, { name: "Лазган" });
  const shooter = { uuid: "Actor.shooter", name: "Стрелок", system: {} };
  globalThis.fromUuid = async uuid => (uuid === "Item.gun" ? gun : uuid === "Actor.shooter" ? shooter : null);
  const actor = defender([blade({ powerField })]);
  await _performParry(actor, {
    extraMod: 0, attackerUuid: "Actor.shooter", attackerWeaponUuid: "Item.gun",
    hitsCount: 1, burst: false, attackerIsHorde: false, isMelee: false
  });
  return captured.chat.at(-1).content;
}

describe("Щит Клинков: стрельба с Pen 6+ парируется только оружием с Power Field", () => {
  it("Pen 6 и обычный клинок — отказ, названы Pen и Power Field, бросок не делается", async () => {
    const html = await parryShot({ pen: 6 });
    expect(html).toContain("Power Field");
    expect(html).toContain("Pen");
    expect(html).not.toContain("Парирование успешно");
  });

  it("Pen 6 и клинок с Power Field — Парирование проходит как обычно", async () => {
    const html = await parryShot({ pen: 6, powerField: true });
    expect(html).toContain("Парирование успешно");
  });

  it("Pen 5 и обычный клинок — парирует (порог книги 6 включительно)", async () => {
    const html = await parryShot({ pen: 5 });
    expect(html).toContain("Парирование успешно");
  });

  it("Pen 12 и обычный клинок — отказ", async () => {
    const html = await parryShot({ pen: 12 });
    expect(html).not.toContain("Парирование успешно");
  });
});
