// test/rules/berserker-talents.test.mjs
//
// Таланты Берсерка, завязанные на Базу рукопашной атаки (Sahara 3-861e):
//   Berserk Charge / Натиск Берсерка (корбук, pdf-стр. 62): «Он получает еще +10
//   на рукопашные приемы при Натиске». Натиск сам даёт +20 (MELEE_BASES) — с
//   Талантом +30.
// И общий предикат meleeBaseIs — «какая База держится на акторе» (system.meleeBase).

import "../support/foundry-stub.mjs";

import { describe, it, expect, vi } from "vitest";
import {
  berserkChargeBonus, meleeBaseBonus
} from "../../module/rules/berserker-talents.mjs";
import { PREDICATES, CTX_DEPENDENT_PREDICATES } from "../../module/rules/predicates.mjs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";

const talent = name => ({ type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });
const talentByKey = key => ({
  type: "talent", name: "ИСПОРЧЕННОЕ ИМЯ", system: {}, getFlag: () => undefined,
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key }
  ] }] } }
});
const actor = ({ meleeBase, items = [] } = {}) => ({ system: { meleeBase, characteristics: {} }, items });
const BERSERK = "Berserk Charge / Натиск Берсерка";

describe("предикат meleeBaseIs — База, которая держится на акторе", () => {
  it("один ключ и список; пустая База — «Стандартная»", () => {
    expect(PREDICATES.meleeBaseIs(actor({ meleeBase: "charge" }), {}, "charge")).toBe(true);
    expect(PREDICATES.meleeBaseIs(actor({ meleeBase: "charge" }), {}, ["fullatk", "charge"])).toBe(true);
    expect(PREDICATES.meleeBaseIs(actor({ meleeBase: "fullatk" }), {}, "charge")).toBe(false);
    expect(PREDICATES.meleeBaseIs(actor({}), {}, "standard")).toBe(true);
    expect(PREDICATES.meleeBaseIs(actor({}), {}, "charge")).toBe(false);
  });

  it("безопасен к отсутствию актора и возвращает строго булево", () => {
    expect(PREDICATES.meleeBaseIs(null, {}, "standard")).toBe(true);
    expect(PREDICATES.meleeBaseIs(actor({ meleeBase: "charge" }), {}, [])).toBe(false);
    expect(PREDICATES.meleeBaseIs(actor({ meleeBase: "charge" }), {}, undefined)).toBe(false);
  });

  it("читает только актора, поэтому доступен записям Конструктора (мост when.predicates)", () => {
    expect(CTX_DEPENDENT_PREDICATES.has("meleeBaseIs")).toBe(false);
    const entry = { when: { predicates: { meleeBaseIs: ["charge"] } } };
    let errors;
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(entryWhenOk(actor({ meleeBase: "charge" }), entry)).toBe(true);
    expect(entryWhenOk(actor({ meleeBase: "standard" }), entry)).toBe(false);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe("Натиск Берсерка: +10 к рукопашному приёму при Натиске", () => {
  it("только на Базе «Натиск»: Стандартная, Полная, Осторожная, Верховая — без добавки", () => {
    const a = actor({ items: [talent(BERSERK)] });
    expect(berserkChargeBonus(a, "charge")).toBe(10);
    for (const key of ["standard", "fullatk", "careful", "mounted"]) expect(berserkChargeBonus(a, key), key).toBe(0);
  });

  it("без Таланта Натиск остаётся +20", () => {
    expect(berserkChargeBonus(actor(), "charge")).toBe(0);
    expect(meleeBaseBonus(actor(), "charge")).toBe(20);
  });

  it("Талант опознаётся по имени (любая половина) и по записи Конструктора", () => {
    expect(berserkChargeBonus(actor({ items: [talent("Berserk Charge")] }), "charge")).toBe(10);
    expect(berserkChargeBonus(actor({ items: [talentByKey("berserker.core.berserkCharge")] }), "charge")).toBe(10);
    expect(berserkChargeBonus(actor({ items: [talentByKey("berserker.core.hatred")] }), "charge")).toBe(0);
  });

  it("meleeBaseBonus: число Базы из книги плюс Талант", () => {
    const a = actor({ items: [talent(BERSERK)] });
    expect(meleeBaseBonus(a, "charge")).toBe(30);
    expect(meleeBaseBonus(a, "standard")).toBe(10);
    expect(meleeBaseBonus(a, "fullatk")).toBe(30);
    expect(meleeBaseBonus(a, "careful")).toBe(-10);
    expect(meleeBaseBonus(a, "нет-такой")).toBe(0);
    expect(meleeBaseBonus(null, "charge")).toBe(20);
  });
});
