// test/rules/squat-traits.test.mjs
//
// Расовые Черты Сквата (сверка главы I, 28.09.2026): Умелые Руки, Крепкий как
// Камень, Надёжная Поступь, Пустота в Венах. Фикстуры Черт — НАСТОЯЩИЕ
// документы packs-src (по id), иначе зелёный тест не доказал бы, что
// возможность действительно едет с Чертой.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { collectTestMods } from "../../module/rules/roll-mods.mjs";
import { vitalNaturalStage } from "../../module/constants/vitals.mjs";
import { nextMutationThreshold } from "../../module/rules/character.mjs";
import { RAD_PROTECTION } from "../../module/constants/environment.mjs";
import {
  CLEVER_HANDS, HARD_AS_STONE, SURE_TREAD, MUTATIONS_AS_ASTARTES,
  cleverHandsClearJamBonus, poisonResistReroll, sleepGraceDays, sleepNeededHours,
  sureTreadTerrainBase, sureTreadIgnoresTerrain, sureTreadMovementCap
} from "../../module/rules/squat-traits.mjs";

const DAY = 86400;
const CLEVER = packDocById("packs-src/traits", "OvEMR1pCdDGL6jkJ");
const STONE  = packDocById("packs-src/traits", "IsGR11cplUwRIuZv");
const TREAD  = packDocById("packs-src/traits", "RZ8eDsBa4H4r9l99");
const VOID   = packDocById("packs-src/traits", "PIbpL2lzqGFcW0LY");
const SQUAT  = packDocById("packs-src/races/Другие_Ксеносы", "KcqfkjljcbTNVEAW");

const asItem = (doc, id = "t1") => ({ id, name: doc.name, type: doc.type, system: doc.system, flags: doc.flags });
function actor(docs = [], system = {}) {
  const items = docs.map((d, i) => asItem(d, `t${i}`));
  return { id: "a1", type: "character", system: { characteristics: {}, skills: {}, ...system },
           items: Object.assign([...items], { contents: items }) };
}

describe("Черты несут свои возможности (данные пака)", () => {
  it("Умелые Руки → trait.cleverHands", () => {
    expect(hasRuleFlag(actor([CLEVER]), CLEVER_HANDS)).toBe(true);
    expect(hasRuleFlag(actor([]), CLEVER_HANDS)).toBe(false);
  });

  it("Крепкий как Камень → лечится как Космодесантник, мутирует как Космодесантник, своя возможность", () => {
    const a = actor([STONE]);
    expect(hasRuleFlag(a, "healing.astartes")).toBe(true);
    expect(hasRuleFlag(a, MUTATIONS_AS_ASTARTES)).toBe(true);
    expect(hasRuleFlag(a, HARD_AS_STONE)).toBe(true);
  });

  it("Надёжная Поступь → trait.sureTread и −1 SPD записью Движения", () => {
    expect(hasRuleFlag(actor([TREAD]), SURE_TREAD)).toBe(true);
    const move = TREAD.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(e => e.kind === "movement");
    expect(move).toMatchObject({ movementTarget: "spd", movementValue: -1 });
    // Мёртвый ActiveEffect на несуществующий system.speed снят: −1 SPD живёт
    // только записью Движения, второго (молчащего) источника нет.
    expect(TREAD.effects.some(e => (e.system?.changes ?? []).some(c => c.key === "system.speed"))).toBe(false);
  });

  it("Пустота в Венах — Преимущество (лучший из 2) на тесты Ловкости и Акробатики", () => {
    const a = actor([VOID]);
    const onAg   = resolveTest({ actor: a, kind: "skill", char: "ag" }).rerolls;
    const onAcro = resolveTest({ actor: a, kind: "skill", skill: "acrobatics", char: "ag" }).rerolls;
    const onAwar = resolveTest({ actor: a, kind: "skill", skill: "awareness", char: "per" }).rerolls;
    expect(onAg).toEqual([expect.objectContaining({ mode: "keepBest", rolls: 2, who: "self" })]);
    expect(onAcro).toHaveLength(1);
    expect(onAwar).toEqual([]);
  });
});

describe("Умелые Руки — галочки +15/+15 на Ремесло, Техпользование, Безопасность", () => {
  const a = actor([CLEVER]);
  const labels = ctx => resolveTest({ actor: a, ...ctx }).mods.filter(m => /Умелые Руки/.test(m.label));

  it("на Ремесле (групповой навык) две галочки по +15", () => {
    const mods = labels({ kind: "skill", group: "trade", char: "int" });
    expect(mods.map(m => m.value)).toEqual([15, 15]);
    expect(mods.every(m => m.askOnly)).toBe(true);
  });

  it("на Техпользовании и Безопасности — тоже", () => {
    expect(labels({ kind: "skill", skill: "techUse", char: "int" })).toHaveLength(2);
    expect(labels({ kind: "skill", skill: "security", char: "ag" })).toHaveLength(2);
  });

  it("на прочих навыках — нет", () => {
    expect(labels({ kind: "skill", skill: "athletics", char: "s" })).toEqual([]);
  });

  it("без Черты — нет", () => {
    expect(resolveTest({ actor: actor([]), kind: "skill", skill: "techUse", char: "int" }).mods
      .filter(m => /Умелые Руки/.test(m.label))).toEqual([]);
  });

  it("в бросках без диалога галочки не складываются сами", () => {
    expect(collectTestMods(a, { kind: "skill", skill: "techUse", char: "int" }).parts
      .some(p => /Умелые Руки/.test(p))).toBe(false);
  });

  it("Расклин — экстремальная ситуация по книге: +30 сам", () => {
    expect(cleverHandsClearJamBonus(a)).toBe(30);
    expect(cleverHandsClearJamBonus(actor([]))).toBe(0);
  });
});

describe("Крепкий как Камень", () => {
  it("тест против яда (Отравление) — с Преимуществом", () => {
    expect(poisonResistReroll(actor([STONE]), "poisoned"))
      .toEqual({ rolls: 2, mode: "keepBest", label: expect.stringMatching(/Крепкий как Камень/) });
  });

  it("не яд или без Черты — обычный бросок", () => {
    expect(poisonResistReroll(actor([STONE]), "burning")).toBeNull();
    expect(poisonResistReroll(actor([]), "poisoned")).toBeNull();
  });

  it("сон: до 3 суток без штрафа, дальше — лестница стадий", () => {
    const ctx = { sleepGraceDays: sleepGraceDays(actor([STONE])) };
    expect(ctx.sleepGraceDays).toBe(3);
    expect(vitalNaturalStage("sleep", 0, 2.9 * DAY, ctx)).toBe(0);
    expect(vitalNaturalStage("sleep", 0, 3 * DAY, ctx)).toBe(1);
    expect(vitalNaturalStage("sleep", 0, 5 * DAY, ctx)).toBe(3);
  });

  it("сон человека не изменился", () => {
    expect(sleepGraceDays(actor([]))).toBe(1);
    expect(vitalNaturalStage("sleep", 0, 1 * DAY, {})).toBe(1);
    expect(vitalNaturalStage("sleep", 0, 1 * DAY, { sleepGraceDays: 1 })).toBe(1);
  });

  it("длительность сна: 3 ч, +3 ч за бессонные сутки, не больше 9", () => {
    expect([0, 1, 2, 3, 7].map(sleepNeededHours)).toEqual([3, 6, 9, 9, 9]);
  });

  it("мутации по порогам Космодесантника, если есть возможность", () => {
    const sys = { race: "squat", corruption: { value: 20 } };
    expect(nextMutationThreshold(sys)).toBe(40);
    expect(nextMutationThreshold(sys, { asAstartes: true })).toBe(30);
  });

  it("защита от радиации −3 — в справочной таблице окна Окружения", () => {
    expect(RAD_PROTECTION).toContainEqual(expect.objectContaining({ val: "−3", label: expect.stringMatching(/Hard as Stone/) }));
  });
});

describe("Надёжная Поступь", () => {
  it("Трудный Ландшафт: берёт лучшее из Ловкости и Бдительности", () => {
    const a = actor([TREAD], { characteristics: { ag: { total: 20 } }, skills: { awareness: { total: 35 } } });
    expect(sureTreadTerrainBase(a)).toMatchObject({ base: 35, char: "per", skill: "awareness" });
    const b = actor([TREAD], { characteristics: { ag: { total: 40 } }, skills: { awareness: { total: 35 } } });
    expect(sureTreadTerrainBase(b)).toMatchObject({ base: 40, char: "ag" });
  });

  it("без Черты — всегда Ловкость", () => {
    const a = actor([], { characteristics: { ag: { total: 20 } }, skills: { awareness: { total: 35 } } });
    expect(sureTreadTerrainBase(a)).toMatchObject({ base: 20, char: "ag" });
  });

  it("3+ Успеха — Ландшафт не замедляет (только с Чертой и только при успехе)", () => {
    const a = actor([TREAD]);
    expect(sureTreadIgnoresTerrain(a, true, 3)).toBe(true);
    expect(sureTreadIgnoresTerrain(a, true, 2)).toBe(false);
    expect(sureTreadIgnoresTerrain(a, false, 5)).toBe(false);
    expect(sureTreadIgnoresTerrain(actor([]), true, 5)).toBe(false);
  });

  it("пешком не больше 3×SPD за Ход: Бег урезан до Натиска", () => {
    expect(sureTreadMovementCap({ halfMove: 2, move: 4, charge: 6, run: 12 }))
      .toEqual({ halfMove: 2, move: 4, charge: 6, run: 6 });
    // Повален/без ног — числа уже меньше, потолок их не поднимает.
    expect(sureTreadMovementCap({ halfMove: 0, move: 0, charge: 0, run: 0 }).run).toBe(0);
  });
});

describe("Раса Сквата против книги", () => {
  const entries = SQUAT.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

  it("Common Lore — любые 4", () => {
    const lore = entries.find(e => e.kind === "skill" && e.skillKey === "commonLore");
    expect(lore.specChoiceCount).toBe(4);
  });

  it("Трейты расы — все пять книжных, включая Пустоту в Венах", () => {
    const names = entries.filter(e => e.kind === "trait").map(e => e.sourceName.split(" / ")[0]);
    for (const n of ["Fast Learner", "Clever Hands", "Hard as Stone", "Sure Tread", "Void in Veins",
                     "Blunted", "Sturdy", "Unnatural Strength", "Unnatural Toughness"]) {
      expect(names).toContain(n);
    }
  });

  it("снаряжение — текстом книги", () => {
    expect(SQUAT.system.gear).toBe("5 элементов Снаряжения и Инструментов до R1 из них 3 Good.Q и 2 Best.Q, Vox-Bead, +2 очка Стартового Снаряжения");
  });
});
