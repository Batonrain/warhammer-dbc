// test/rules/library/ogryn-traits.test.mjs
//
// Сверка расы Огрин с корбуком (глава I): Черты «Brute Physiology /
// Физиология Громилы» и «BONE-Head / Костеголов» работают по самой Черте —
// и у персонажа-Огрина, и у Миньона с комплексным Трейтом «Ogryn», у
// которого расы нет.

import { describe, it, expect } from "vitest";
import "../../support/foundry-stub.mjs";
import { packDocById } from "../../support/pack-doc.mjs";
import { resolveTest } from "../../../module/rules/resolve-test.mjs";
import { resolveKindOutcome } from "../../../module/rules/kind-outcome.mjs";
import { hasRuleFlag } from "../../../module/rules/flags.mjs";
import { OGRYN_TRAIT_RULES } from "../../../module/rules/library/ogryn.mjs";
import { OGRYN_FIT_FLAG, ogrynAttackPenalty } from "../../../module/rules/ogryn-fit.mjs";
import { planBruteRegen, BRUTE_REGEN_PERIOD } from "../../../module/rules/brute-regen.mjs";
import { haywireRoundsAtThree } from "../../../module/combat/damage.mjs";
import { isImmuneToCondition } from "../../../module/rules/condition-guards.mjs";
import { CONDITIONS } from "../../../module/constants/conditions.mjs";

const BRUTE_PACK = packDocById("packs-src/traits", "ZM5JfxTzLTfByO46");

const trait = name => ({ type: "trait", name, system: {} });
const BRUTE = trait("Brute Physiology / Физиология Громилы");
const BONE = trait("BONE-Head / Костеголов");

/** Миньон-огрин: расы нет, Черты есть. */
const minion = (conditions = {}, items = [BRUTE, BONE]) => ({
  system: { race: "", characteristics: {}, conditions }, items,
  getFlag: () => undefined, setFlag: async () => {}
});

describe("Brute Physiology — возможности по Черте, не по расе", () => {
  it.each([OGRYN_FIT_FLAG, "bleeding.noDeath", "stun.shakeOffTurnEnd", "healing.bruteRegen"])(
    "Миньон с Чертой получает %s", flag => {
      expect(hasRuleFlag(minion(), flag)).toBe(true);
    });

  it("без Черты — ничего", () => {
    const a = minion({}, []);
    expect(hasRuleFlag(a, "bleeding.noDeath")).toBe(false);
    expect(hasRuleFlag(a, "haywire.boneHead")).toBe(false);
  });

  it("иммунитет к Обескровливанию — запись Механики самой Черты", () => {
    const a = { items: [BRUTE_PACK] };
    expect(isImmuneToCondition(a, "haemorrhaging")).toBe(true);
    expect(isImmuneToCondition(a, "bleeding")).toBe(false);
  });

  it("−20 тонкой манипуляции — галочка на тестах Ag/Int/Per, не авто и не на атаке", () => {
    const skill = resolveTest({ actor: minion(), skill: "security", char: "ag" });
    expect(skill.mods).toEqual([expect.objectContaining({ ruleId: "ogryn.brute.fineWork", value: -20 })]);
    expect(skill.autoMods.some(m => m.ruleId === "ogryn.brute.fineWork")).toBe(false);
    const strength = resolveTest({ actor: minion(), skill: "athletics", char: "s" });
    expect(strength.mods.some(m => m.ruleId === "ogryn.brute.fineWork")).toBe(false);
    const attack = resolveTest({ actor: minion(), kind: "attack", isMelee: true, char: "ws" });
    expect(attack.mods.some(m => m.ruleId === "ogryn.brute.fineWork")).toBe(false);
  });
});

describe("BONE-Head — тест I не больше 1 Успеха", () => {
  it("успешный тест I упирается в 1 Успех", async () => {
    const a = minion();
    const o = await resolveKindOutcome(a, { kind: "base", baseEff: 60, rv: 15, ctx: { actor: a, kind: "skill", char: "int" } });
    expect(o.success).toBe(true);
    expect(o.deg).toBe(1);
    expect(o.unnaturalLine).toContain("BONE-Head");
  });

  it("Навык на I (Tech-Use) — тоже", async () => {
    const a = minion();
    const o = await resolveKindOutcome(a, { kind: "base", baseEff: 60, rv: 15, ctx: { actor: a, kind: "skill", skill: "techUse", char: "int" } });
    expect(o.deg).toBe(1);
  });

  it("тест не на I и провал — не трогаются", async () => {
    const a = minion();
    const ag = await resolveKindOutcome(a, { kind: "base", baseEff: 60, rv: 15, ctx: { actor: a, kind: "skill", char: "ag" } });
    expect(ag.deg).toBe(5);
    const fail = await resolveKindOutcome(a, { kind: "base", baseEff: 20, rv: 55, ctx: { actor: a, kind: "skill", char: "int" } });
    expect(fail.success).toBe(false);
    expect(fail.deg).toBe(4);
  });

  it("Сбой импланта (Haywire 3+) — тест I провален даже на хорошем броске", async () => {
    expect(CONDITIONS.implantHaywire).toBeTruthy();
    const a = minion({ implantHaywire: true });
    const o = await resolveKindOutcome(a, { kind: "base", baseEff: 60, rv: 15, ctx: { actor: a, kind: "skill", char: "int" } });
    expect(o.success).toBe(false);
  });

  it("Сбой без Черты BONE-Head ничего не проваливает", async () => {
    const a = minion({ implantHaywire: true }, [BRUTE]);
    const o = await resolveKindOutcome(a, { kind: "base", baseEff: 60, rv: 15, ctx: { actor: a, kind: "skill", char: "int" } });
    expect(o.success).toBe(true);
  });

  it("поле держится на 3+ столько Ходов: затухает на 2 за Ход", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(haywireRoundsAtThree)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe("Brute Physiology — восстановление Ран", () => {
  // T.b 10 (Огрин: T 45 + Unnatural T (6)): тяжело ранен — потеряно больше 20.
  const sys = (value, critical = 0) => ({
    wounds: { value, max: 40, critical }, characteristics: { t: { bonus: 10 } }
  });

  it("периоды по книге: минута, 10 минут, час", () => {
    expect(BRUTE_REGEN_PERIOD).toEqual({ light: 60, heavy: 600, critical: 3600 });
  });

  it("легко ранен: 1 Рана в минуту", () => {
    const p = planBruteRegen(sys(35), 0, { from: 0, to: 180 });
    expect(p.healed).toBe(3);
    expect(p.wounds.value).toBe(38);
    expect(p.flagAt).toBe(180);
  });

  it("тяжело ранен: 1 Рана в 10 минут, затем уже как лёгкий", () => {
    // 19/40 — потеряна 21 (> 20) → тяжёлое; после первой Раны (20/40, −20) — лёгкое.
    const p = planBruteRegen(sys(19), 0, { from: 0, to: 600 + 120 });
    expect(p.healed).toBe(3);
    expect(p.wounds.value).toBe(22);
  });

  it("критически ранен: сперва час на Рану в минусе", () => {
    const p = planBruteRegen(sys(0, 2), 0, { from: 0, to: 3600 });
    expect(p.healed).toBe(1);
    expect(p.wounds.critical).toBe(1);
  });

  it("до полного — и метка снимается", () => {
    const p = planBruteRegen(sys(39), 0, { from: 0, to: 10_000 });
    expect(p.healed).toBe(1);
    expect(p.wounds.value).toBe(40);
    expect(p.flagAt).toBeNull();
  });

  it("первый раз метки нет — отсчёт с начала отрезка, прошлое не начисляется", () => {
    const p = planBruteRegen(sys(35), null, { from: 1000, to: 1030 });
    expect(p).toEqual({ healed: 0, wounds: null, flagAt: 1000 });
  });

  it("здоров и без метки — писать нечего", () => {
    expect(planBruteRegen(sys(40), null, { from: 0, to: 600 })).toBeNull();
  });
});

describe("Ogrynized — «кроме гранат»", () => {
  it("Огрин с обычной гранатой — без штрафа", () => {
    expect(ogrynAttackPenalty({ fitsOgryn: true, isRanged: true, isGrenade: true }).total).toBe(0);
  });
  it("Огрин с обычным стрелковым — −20, с рукопашным — −10", () => {
    expect(ogrynAttackPenalty({ fitsOgryn: true, isRanged: true }).total).toBe(-20);
    expect(ogrynAttackPenalty({ fitsOgryn: true, isRanged: false }).total).toBe(-10);
  });
});

describe("паки Огрина против книги", () => {
  it("у расы нет Черт Сквата (Clever Hands, Hard as Stone)", () => {
    const race = packDocById("packs-src/races/Люди", "tjQaSHFHxbt1tvWU");
    const names = race.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).map(e => e.sourceName);
    expect(names).toContain("Brute Physiology / Физиология Громилы");
    expect(names).toContain("BONE-Head / Костеголов");
    expect(names).not.toContain("Clever Hands / Умные Руки");
    expect(names).not.toContain("Hard as Stone / Крепкий как Камень");
  });

  it("Трейт Миньона «Ogryn»: +15 Ран только через Brute Physiology, без надбавки к Бонусам", () => {
    const t = packDocById("packs-src/traits", "0r0IX0R5hhdJ1gzj");
    const entries = t.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
    expect(entries.some(e => e.kind === "wounds")).toBe(false);
    const keys = t.effects.flatMap(e => e.system.changes.map(c => c.key));
    expect(keys.some(k => k.endsWith(".bonusFx"))).toBe(false);
    expect(keys).toContain("system.characteristics.s.totalFx");
  });

  it("правила Черт заведены на обе Черты", () => {
    const ids = OGRYN_TRAIT_RULES.map(r => r.id);
    expect(ids.filter(id => id.startsWith("ogryn.brute."))).toHaveLength(5);
    expect(ids.filter(id => id.startsWith("ogryn.boneHead."))).toHaveLength(4);
  });
});
