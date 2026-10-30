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

// ── Один Из Нас Падёт / One Will Go Down (Sahara 3-861e) ─────────────────────
// Книга (core.json, pdf-стр. 78): «Совершая атаку с базой Полная Атака по Ненавистной цели,
// персонаж может удвоить ее Dmg (до Поглощения). Если эта атака убивает или выводит врага из
// строя, персонаж получает 1 Усталости, если нет (в т.ч. из-за промаха) – T.b+W.b Усталости (и
// немедленно теряет сознание). Независимо от успеха, персонаж также получает 1d5
// непоглощаемого R Dmg в руку, которой он атаковал».
import {
  oneWillGoDownOffered, oneWillGoDownApplies, oneWillGoDownFatigue, ONE_WILL_SELF_DAMAGE
} from "../../module/rules/berserker-talents.mjs";
import { raceTarget } from "../../module/rules/talent-targets.mjs";

describe("Один Из Нас Падёт: когда срабатывает", () => {
  const OWGD = "One Will Go Down / Один Из Нас Падёт";
  const hatred = { type: "talent", name: "Hatred / Ненависть", system: { targets: [raceTarget("ork", "Орк")] }, flags: {}, getFlag: () => undefined };
  const ork = { system: { race: "ork" } };
  const human = { system: { race: "human" } };
  const hero = (items = [talent(OWGD), hatred]) => ({ system: { characteristics: { t: { bonus: 4 }, wp: { bonus: 3 } } }, items });
  const on = { oneWillGoDown: true };

  it("предлагается только рукопашной атаке носителя Таланта", () => {
    expect(oneWillGoDownOffered(hero(), { isMelee: true })).toBe(true);
    expect(oneWillGoDownOffered(hero(), { isMelee: false })).toBe(false);
    expect(oneWillGoDownOffered(hero([hatred]), { isMelee: true })).toBe(false);
  });

  it("срабатывает на Полной Атаке по Ненавистной цели с включённой галочкой", () => {
    expect(oneWillGoDownApplies(hero(), { isMelee: true, baseKey: "fullatk", toggles: on, targetActor: ork })).toBe(true);
  });

  it("не срабатывает без галочки, на другой Базе, по не-Ненавистной цели, без цели, в стрельбе", () => {
    const base = { isMelee: true, baseKey: "fullatk", toggles: on, targetActor: ork };
    expect(oneWillGoDownApplies(hero(), { ...base, toggles: {} })).toBe(false);
    for (const baseKey of ["standard", "charge", "careful", "mounted", undefined]) {
      expect(oneWillGoDownApplies(hero(), { ...base, baseKey }), String(baseKey)).toBe(false);
    }
    expect(oneWillGoDownApplies(hero(), { ...base, targetActor: human })).toBe(false);
    expect(oneWillGoDownApplies(hero(), { ...base, targetActor: null })).toBe(false);
    expect(oneWillGoDownApplies(hero(), { ...base, isMelee: false })).toBe(false);
  });

  it("Талант без Ненависти (Требование не выполнено) цели не находит — не срабатывает", () => {
    expect(oneWillGoDownApplies(hero([talent(OWGD)]), { isMelee: true, baseKey: "fullatk", toggles: on, targetActor: ork })).toBe(false);
  });

  it("Талант опознаётся и по записи Конструктора", () => {
    const byKey = hero([talentByKey("berserker.core.oneWillGoDown"), hatred]);
    expect(oneWillGoDownApplies(byKey, { isMelee: true, baseKey: "fullatk", toggles: on, targetActor: ork })).toBe(true);
  });

  it("переброс той же атаки (replay) сохраняет эффект без галочки", () => {
    expect(oneWillGoDownApplies(hero(), { isMelee: true, baseKey: "fullatk", toggles: {}, targetActor: ork, replay: true })).toBe(true);
    expect(oneWillGoDownApplies(hero(), { isMelee: true, baseKey: "fullatk", toggles: {}, targetActor: ork, replay: false })).toBe(false);
  });

  it("переброс оплаченной атаки не требует выделенной цели (иначе ×2 пропадёт, а следующий переброс снова ранит руку)", () => {
    expect(oneWillGoDownApplies(hero(), { isMelee: true, baseKey: "fullatk", toggles: {}, targetActor: null, replay: true })).toBe(true);
    expect(oneWillGoDownApplies(hero(), { isMelee: true, baseKey: "standard", toggles: {}, targetActor: null, replay: true })).toBe(false);
    expect(oneWillGoDownApplies(hero([hatred]), { isMelee: true, baseKey: "fullatk", toggles: {}, targetActor: null, replay: true })).toBe(false);
  });
});

describe("Один Из Нас Падёт: цена", () => {
  const a = { system: { characteristics: { t: { bonus: 4 }, wp: { bonus: 3 } } } };

  it("вывел из строя — 1 Усталости; нет (в т.ч. промах) — T.b+W.b", () => {
    expect(oneWillGoDownFatigue(a, true)).toBe(1);
    expect(oneWillGoDownFatigue(a, false)).toBe(7);
  });

  it("устойчива к отсутствию бонусов и отрицательным значениям", () => {
    expect(oneWillGoDownFatigue({ system: { characteristics: {} } }, false)).toBe(0);
    expect(oneWillGoDownFatigue(null, true)).toBe(1);
    expect(oneWillGoDownFatigue({ system: { characteristics: { t: { bonus: -2 }, wp: { bonus: 3 } } } }, false)).toBe(3);
  });

  it("урон в руку — 1d5", () => {
    expect(ONE_WILL_SELF_DAMAGE).toBe("1d5");
  });
});
