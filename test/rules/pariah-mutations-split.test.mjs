// test/rules/pariah-mutations-split.test.mjs
//
// Спорные мутации в Пустоте Парии (task-f568): гаснет только варповая
// субмутация, тело остаётся. Бесспорная строка таблицы docs/pariah-mutations-table.md —
// Панцирь, субм. 9 «Цветастые Перья» (AP против психосил и Варп-оружия).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";
import { PARIAH_VOID_TRAIT } from "../../module/rules/predicates.mjs";

const CARAPACE = packDocById("packs-src/mutations/Общие_мутации", "2n52RpWDImyz3Ev1");

function mkActor(sub, inVoid) {
  const item = structuredClone(CARAPACE);
  item.system.submutation = { label: sub };
  const items = [item, ...(inVoid ? [{ type: "trait", name: PARIAH_VOID_TRAIT, system: {} }] : [])];
  return { id: "A", name: "Панцирный", type: "character", system: {},
    items: Object.assign(items, { contents: items }), getFlag: () => undefined };
}

describe("Панцирь в Пустоте Парии", () => {
  it("«Цветастые Перья» гаснут в Пустоте и работают вне её", () => {
    expect(hasRuleFlag(mkActor("9", false), "armor.apVsWarpFull")).toBe(true);
    expect(hasRuleFlag(mkActor("9", true), "armor.apVsWarpFull")).toBe(false);
  });
  it("физические субмутации в Пустоте остаются (8 — иммунитет к Flame)", () => {
    expect(hasRuleFlag(mkActor("8", true), "weaponPropertyImmunity.flame")).toBe(true);
  });
});
