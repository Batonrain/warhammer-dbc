// test/rules/noise-marine.test.mjs
//
// Шумовой Десантник (Элитный архетип, Sahara 1-54b9): чистая логика rules/noise-marine.mjs
// и сквозные проверки через конвейер теста на ЖИВЫХ записях packs-src.
//   Пьянящий Рёв — +2 за каждого другого участника боя (макс. +12) на T, Страх и Подавление;
//     +20 слух (галочка) и «не застать врасплох» (attack.surpriseImmune) — запись Конструктора.
//   Боль Это Наслаждение — +10 за уровень на все тесты, макс. +30; срок — концы Ходов носителя.
//   Стена Диссонанса — геометрия и иммунитет по Размеру.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import {
  uproarBonus, otherCombatantsCount, painIsPleasureBonus, painIsPleasureNext, painIsPleasureAtTurnEnd,
  noiseMarineRules, wallOfDiscordGeometry, wallImmuneBySize, wallPushDestination, knockbackWithinLimit
} from "../../module/rules/noise-marine.mjs";
import { effectAppliesTo, resolveTest } from "../../module/rules/resolve-test.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";

const SYSTEM = "warhammer-dbc";
const ROOT = path.resolve(import.meta.dirname, "../..");

function packItem(rel, prefix) {
  const dir = path.join(ROOT, "packs-src", rel);
  const file = fs.readdirSync(dir).find(f => f.startsWith(prefix));
  return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
}
const uproarTrait = () => packItem("traits/Элитные_архетипы/Шумовой_Десантник", "Intoxicating_Uproar");
const painTalent = () => packItem("talents/Элитные_архетипы/Шумовой_Десантник", "Pain_Is_Pleasure");

function marine(items, flags = {}) {
  return {
    id: "marineA", name: "Шумовой", type: "character", system: { characteristics: { t: { total: 50 } }, corruptionBonus: 4 },
    items: items.map((i, n) => ({ id: `i${n}`, ...i })),
    getFlag: (scope, key) => flags[`${scope}.${key}`]
  };
}
const combatOf = (...actorIds) => ({
  started: true,
  combatants: actorIds.map((id, n) => ({ id: `c${n}`, actorId: id, isDefeated: false }))
});

afterEach(() => { globalThis.game.combat = undefined; });

describe("Пьянящий Рёв: число", () => {
  it("+2 за участника, не больше +12", () => {
    expect(uproarBonus(0)).toBe(0);
    expect(uproarBonus(3)).toBe(6);
    expect(uproarBonus(6)).toBe(12);
    expect(uproarBonus(40)).toBe(12);
  });

  it("считает ДРУГИХ участников боя; павшие не в счёт; вне боя — null", () => {
    const a = marine([]);
    const combat = combatOf("marineA", "e1", "e2", "e3");
    combat.combatants[3].isDefeated = true;
    expect(otherCombatantsCount(a, combat)).toBe(2);
    expect(otherCombatantsCount(a, { started: false, combatants: [] })).toBeNull();
    expect(otherCombatantsCount(a, combatOf("e1", "e2"))).toBeNull();
  });
});

describe("Пьянящий Рёв: правило в конвейере теста (запись packs-src)", () => {
  const withUproar = () => marine([uproarTrait()]);

  it("область fear ловит только тест Страха", () => {
    expect(effectAppliesTo("fear", { kind: "skill", char: "wp", morale: true, fearTest: true })).toBe(true);
    expect(effectAppliesTo("fear", { kind: "skill", char: "wp", morale: true })).toBe(false);
    expect(effectAppliesTo("fear", { kind: "skill", char: "wp" })).toBe(false);
  });

  it("в бою с 3 другими бойцами: +6 на T, Страх и Подавление, не на Ловкость", () => {
    const a = withUproar();
    globalThis.game.combat = combatOf("marineA", "e1", "e2", "e3");
    const sum = ctx => resolveTest({ actor: a, ...ctx }).autoMods
      .filter(m => String(m.ruleId).includes("intoxicatingUproar")).reduce((s, m) => s + m.value, 0);
    expect(sum({ kind: "skill", char: "t" })).toBe(6);
    expect(sum({ kind: "skill", char: "wp", morale: true, fearTest: true })).toBe(6);
    expect(sum({ kind: "skill", char: "wp", morale: true, suppressionTest: true })).toBe(6);
    expect(sum({ kind: "skill", char: "ag" })).toBe(0);
    expect(sum({ kind: "skill", char: "wp", morale: true })).toBe(0);
  });

  it("потолок +12 при толпе; вне боя бонуса нет", () => {
    const a = withUproar();
    globalThis.game.combat = combatOf("marineA", ...Array.from({ length: 20 }, (_, i) => `e${i}`));
    const rules = noiseMarineRules(a);
    expect(rules).toHaveLength(1);
    expect(rules[0].effects[0].value).toBe(12);
    globalThis.game.combat = undefined;
    expect(noiseMarineRules(a)).toEqual([]);
  });

  it("без Черты бонуса нет, даже в бою", () => {
    globalThis.game.combat = combatOf("marineA", "e1");
    expect(noiseMarineRules(marine([]))).toEqual([]);
  });

  it("Конструктор Черты: слух — галочка Внимательности +20, «не застать врасплох» — возможность", () => {
    const a = withUproar();
    expect(hasRuleFlag(a, "attack.surpriseImmune")).toBe(true);
    const awareness = resolveTest({ actor: a, kind: "skill", skill: "awareness", char: "per" });
    expect(awareness.mods.some(m => m.value === 20 && /слух/.test(m.label))).toBe(true);
    const other = resolveTest({ actor: a, kind: "skill", skill: "stealth", char: "ag" });
    expect(other.mods.some(m => /слух/.test(m.label))).toBe(false);
  });
});

describe("Боль Это Наслаждение: счёт", () => {
  it("+10 за уровень, предел +30", () => {
    expect(painIsPleasureBonus(null)).toBe(0);
    expect(painIsPleasureBonus({ stacks: 1 })).toBe(10);
    expect(painIsPleasureBonus({ stacks: 3 })).toBe(30);
    expect(painIsPleasureBonus({ stacks: 9 })).toBe(30);
  });

  it("новый удар копит уровень, срок: чужой Ход — 1 конец, свой — 2", () => {
    const first = painIsPleasureNext(null, { ownTurn: false, combatId: "c1" });
    expect(first).toEqual({ stacks: 1, ends: 1, combatId: "c1" });
    const second = painIsPleasureNext(first, { ownTurn: true, combatId: "c1" });
    expect(second).toEqual({ stacks: 2, ends: 2, combatId: "c1" });
    const capped = painIsPleasureNext({ stacks: 3, ends: 1, combatId: "c1" }, { ownTurn: false, combatId: "c1" });
    expect(capped.stacks).toBe(3);
    expect(capped.ends).toBe(1);
  });

  it("конец Хода убавляет счётчик, на нуле флаг снимается", () => {
    expect(painIsPleasureAtTurnEnd(null)).toBeNull();
    expect(painIsPleasureAtTurnEnd({ stacks: 2, ends: 2, combatId: "c1" })).toEqual({ stacks: 2, ends: 1, combatId: "c1" });
    expect(painIsPleasureAtTurnEnd({ stacks: 2, ends: 1, combatId: "c1" })).toBeNull();
  });

  it("правило: флаг с 2 уровнями — +20 на любой тест (запись packs-src)", () => {
    const a = marine([painTalent()], { [`${SYSTEM}.painIsPleasure`]: { stacks: 2, ends: 1, combatId: "c1" } });
    const res = resolveTest({ actor: a, kind: "skill", skill: "stealth", char: "ag" });
    expect(res.autoMods.filter(m => m.value === 20)).toHaveLength(1);
    const bare = marine([painTalent()]);
    expect(resolveTest({ actor: bare, kind: "skill", skill: "stealth", char: "ag" }).autoMods.some(m => m.value === 20)).toBe(false);
  });
});

describe("Стена Диссонанса: геометрия", () => {
  it("радиус Cor.b×2, отброс Cor.b×3", () => {
    expect(wallOfDiscordGeometry({ system: { corruptionBonus: 4 } })).toEqual({ radius: 8, knockback: 12 });
    expect(wallOfDiscordGeometry({ system: {} })).toEqual({ radius: 0, knockback: 0 });
  });

  it("Размер 2+ неуязвим, при Cor 66+ — только 3+", () => {
    expect(wallImmuneBySize(1, 40)).toBe(false);
    expect(wallImmuneBySize(2, 40)).toBe(true);
    expect(wallImmuneBySize(2, 66)).toBe(false);
    expect(wallImmuneBySize(3, 66)).toBe(true);
  });

  it("точка отброса — по прямой от источника, дальность в метрах сетки", () => {
    const grid = { size: 100, distance: 2 };
    const caster = { x: 0, y: 0, width: 1, height: 1 };
    const target = { x: 200, y: 0, width: 1, height: 1 };
    expect(wallPushDestination(caster, target, grid, 6)).toEqual({ x: 500, y: 0 });
    const diag = wallPushDestination(caster, { x: 0, y: 300, width: 1, height: 1 }, grid, 4);
    expect(diag).toEqual({ x: 0, y: 500 });
  });

  it("релей отвергает сдвиг дальше дальности отброса", () => {
    const grid = { size: 100, distance: 2 };
    const token = { x: 0, y: 0 };
    expect(knockbackWithinLimit(token, { x: 600, y: 0 }, grid, 12)).toBe(true);
    expect(knockbackWithinLimit(token, { x: 1500, y: 0 }, grid, 12)).toBe(false);
    expect(knockbackWithinLimit(token, { x: NaN, y: 0 }, grid, 12)).toBe(false);
  });
});
