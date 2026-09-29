// test/rules/bone-head.test.mjs
//
// «BONE-Head / КОСТеголов» (Огрин, корбук, глава I):
//   «Любой тест I занимает у Огрина минимум полное действие и при Успехе дает
//   не больше 1 Успеха. При попадании в поле Haywire интенсивностью 3+ …
//   автоматически проваливает все тесты I … Попав в поле Haywire
//   интенсивностью 7+, Огрин впадает в Ступор на 1 Раунд, или пока не покинет
//   поле (что произойдет первым)».
//
// Правила — rules/library/ogryn.mjs (OGRYN_TRAIT_RULES, отбор по Черте, а не
// по расе: Черту получает и Миньон с комплексной Чертой «Огрин»); поле
// Haywire — предикат haywireFieldMin (rules/predicates.mjs); потолок Успехов —
// эффект successDegMax (rules/resolve-test.mjs, rules/kind-outcome.mjs).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { PREDICATES, haywireFieldIntensity } from "../../module/rules/predicates.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { resolveKindOutcome } from "../../module/rules/kind-outcome.mjs";
import { OGRYN_TRAIT_RULES } from "../../module/rules/library/ogryn.mjs";
import {
  isBoneHead, decayedHaywire, boneHeadHaywireEffects, HAYWIRE_FIELD_FLAG
} from "../../module/rules/bone-head.mjs";

const boneHead = { type: "trait", name: "BONE-Head / Костеголов", system: {} };
const discordantField = { type: "trait", name: "In the Discordant's Field / В Поле Дискорданта", system: {} };

const flags = {};
const actor = ({ items = [], haywire = 0 } = {}) => ({
  system: { characteristics: { int: { total: 30, bonus: 3 } }, conditions: {} },
  items,
  flags: { "warhammer-dbc": haywire ? { [HAYWIRE_FIELD_FLAG]: haywire } : {} },
  getFlag: (scope, key) => key.split(".").reduce((o, k) => o?.[k], flags[scope]),
  setFlag: async () => {}
});

describe("поле Haywire: интенсивность и предикат", () => {
  it("хранимая интенсивность попадания", () => {
    expect(haywireFieldIntensity(actor({ haywire: 5 }))).toBe(5);
    expect(PREDICATES.haywireFieldMin(actor({ haywire: 5 }), {}, 3)).toBe(true);
    expect(PREDICATES.haywireFieldMin(actor({ haywire: 2 }), {}, 3)).toBe(false);
  });

  it("поле Дискорданта — это Haywire (7) (книга, субраса Дискордант)", () => {
    expect(haywireFieldIntensity(actor({ items: [discordantField] }))).toBe(7);
    expect(PREDICATES.haywireFieldMin(actor({ items: [discordantField] }), {}, 7)).toBe(true);
  });

  it("ни поля, ни ауры — ноль, без ошибок на пустом акторе", () => {
    expect(haywireFieldIntensity(actor())).toBe(0);
    expect(haywireFieldIntensity(undefined)).toBe(0);
    expect(PREDICATES.haywireFieldMin(undefined, {}, 3)).toBe(false);
  });

  it("поле затухает на 2 за Раунд и не уходит ниже нуля", () => {
    expect(decayedHaywire(7, 1)).toBe(5);
    expect(decayedHaywire(3, 1)).toBe(1);
    expect(decayedHaywire(3, 5)).toBe(0);
  });

  it("3+ — импланты сбоят, 7+ — Ступор", () => {
    expect(boneHeadHaywireEffects(2)).toEqual({ impaired: false, stupor: false });
    expect(boneHeadHaywireEffects(3)).toEqual({ impaired: true, stupor: false });
    expect(boneHeadHaywireEffects(7)).toEqual({ impaired: true, stupor: true });
  });

  it("isBoneHead — по Черте, любой половиной имени", () => {
    expect(isBoneHead(actor({ items: [boneHead] }))).toBe(true);
    expect(isBoneHead(actor())).toBe(false);
  });
});

describe("правила BONE-Head в конвейере теста", () => {
  it("у всех правил есть id, и все они привязаны к Черте, а не к расе", () => {
    expect(OGRYN_TRAIT_RULES.length).toBeGreaterThan(0);
    for (const r of OGRYN_TRAIT_RULES) {
      expect(r.id).toMatch(/^ogryn\./);
      expect(r.when?.hasTrait).toBeTruthy();
      expect(r.when?.race).toBeUndefined();
    }
  });

  it("тест I — потолок 1 Успех", () => {
    const res = resolveTest({ actor: actor({ items: [boneHead] }), kind: "skill", char: "int" });
    expect(res.successDegMax?.value).toBe(1);
  });

  it("тест Навыка на I (Common Lore) — тоже", () => {
    const res = resolveTest({ actor: actor({ items: [boneHead] }), kind: "skill", skill: "commonLore", char: "int" });
    expect(res.successDegMax?.value).toBe(1);
  });

  it("тест S — без потолка; без Черты — без потолка", () => {
    expect(resolveTest({ actor: actor({ items: [boneHead] }), kind: "skill", char: "s" }).successDegMax).toBeNull();
    expect(resolveTest({ actor: actor(), kind: "skill", char: "int" }).successDegMax).toBeNull();
  });

  it("в поле Haywire 3+ — автопровал тестов I, ниже 3 — нет", () => {
    const hit = resolveTest({ actor: actor({ items: [boneHead], haywire: 3 }), kind: "skill", char: "int" });
    expect(hit.autoFail.length).toBe(1);
    const low = resolveTest({ actor: actor({ items: [boneHead], haywire: 2 }), kind: "skill", char: "int" });
    expect(low.autoFail).toEqual([]);
  });

  it("в поле Дискорданта — тоже автопровал; не-Огрину поле тестов I не проваливает", () => {
    expect(resolveTest({ actor: actor({ items: [boneHead, discordantField] }), kind: "skill", char: "int" }).autoFail.length).toBe(1);
    expect(resolveTest({ actor: actor({ items: [discordantField] }), kind: "skill", char: "int" }).autoFail).toEqual([]);
  });
});

describe("resolveKindOutcome: потолок Успехов", () => {
  it("Предел 60, бросок 10 — у всех 6 Успехов, у Огрина 1, и строка объясняет почему", async () => {
    const a = actor({ items: [boneHead] });
    const o = await resolveKindOutcome(a, { kind: "base", baseEff: 60, rv: 10, ctx: { actor: a, kind: "skill", char: "int" } });
    expect(o.success).toBe(true);
    expect(o.deg).toBe(1);
    expect(o.degCap).toBe(1);
    expect(o.critLine + o.unnaturalLine + (o.degCapLine ?? "")).toContain("BONE-Head");
  });

  it("провал потолком не трогается", async () => {
    const a = actor({ items: [boneHead] });
    const o = await resolveKindOutcome(a, { kind: "base", baseEff: 20, rv: 90, ctx: { actor: a, kind: "skill", char: "int" } });
    const plain = actor();
    const p = await resolveKindOutcome(plain, { kind: "base", baseEff: 20, rv: 90, ctx: { actor: plain, kind: "skill", char: "int" } });
    expect(o.success).toBe(false);
    expect(o.deg).toBe(p.deg);
    expect(o.deg).toBeGreaterThan(1);
  });

  it("без Черты — обычная степень", async () => {
    const a = actor();
    const o = await resolveKindOutcome(a, { kind: "base", baseEff: 60, rv: 10, ctx: { actor: a, kind: "skill", char: "int" } });
    expect(o.deg).toBe(6);
    expect(o.degCap ?? null).toBeNull();
  });
});
