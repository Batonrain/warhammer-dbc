// test/rules/suppression-scope.test.mjs
//
// Область «suppression» (только тест на Подавление) — Nerves of Steel /
// Стальные Нервы (глава 3, «Смелость», Sahara 3-scope): «Он может
// перебрасывать тесты на Подавление». Область «morale» шире книги (Страх, Шок,
// Паника, встречные Запугивание/Пытки тоже тесты Морали) и для этого Таланта
// не годится — она дала бы лишний переброс Страха и Шока.
//
// Флаг контекста называется suppressionTest, а не suppression: ctx.suppression
// в rules/match-context.mjs уже занят — это «Подавление Травм и Расстройств»
// (Мир-сад, Мир удовольствий, constants/homeworlds.mjs), другая механика.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { effectAppliesTo, resolveTest } from "../../module/rules/resolve-test.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { rollMoraleTest } from "../../module/rules/morale-test.mjs";
import { rollSuppressionTest, rollSuppressionRecovery } from "../../module/combat/suppression.mjs";
import { clearRuleSources, registerRuleSource } from "../../module/rules/sources.mjs";

const SYSTEM = "warhammer-dbc";

describe("effectAppliesTo: область suppression", () => {
  it("совпадает с тестом на Подавление, который к тому же тест Морали", () => {
    expect(effectAppliesTo("suppression", { kind: "skill", char: "wp", morale: true, suppressionTest: true })).toBe(true);
  });

  it("не совпадает с остальными тестами Морали (Страх, Шок, Паника от Горения)", () => {
    expect(effectAppliesTo("suppression", { kind: "skill", char: "wp", morale: true })).toBe(false);
  });

  it("не совпадает с обычным тестом Воли и с атакой", () => {
    expect(effectAppliesTo("suppression", { kind: "skill", char: "wp" })).toBe(false);
    expect(effectAppliesTo("suppression", { kind: "attack", isMelee: true })).toBe(false);
  });

  it("morale по-прежнему ловит и Подавление, и Страх (регресс: Несокрушимая Воля)", () => {
    expect(effectAppliesTo("morale", { morale: true, suppressionTest: true })).toBe(true);
    expect(effectAppliesTo("morale", { morale: true })).toBe(true);
  });
});

describe("Конструктор: запись «Переброс» с областью suppression", () => {
  const item = entries => ({ id: "n", name: "Стальные Нервы",
    flags: { [SYSTEM]: { mechanics: [{ id: "g1", operator: "AND", entries }] } } });

  it("превращается в правило rollMode с target suppression", () => {
    const rules = rulesFromItemMechanics([item([
      { id: "e1", kind: "reroll", rerollScope: "suppression", rerollMode: "keepBest", label: "Стальные Нервы" }])]);
    expect(rules).toHaveLength(1);
    expect(rules[0].effects).toEqual([{ kind: "rollMode", target: "suppression", mode: "keepBest", rolls: 2, who: "self" }]);
  });
});

describe("Стальные Нервы в конвейере теста", () => {
  const actor = { name: "Стойкий", type: "character", system: {}, items: [{
    id: "n", name: "Nerves of Steel / Стальные Нервы", type: "talent",
    flags: { [SYSTEM]: { mechanics: [{ id: "g1", operator: "AND", entries: [
      { id: "e1", kind: "reroll", rerollScope: "suppression", rerollMode: "keepBest", label: "Стальные Нервы" }] }] } }
  }] };

  it("тест Подавления предлагает переброс, Страх — нет", () => {
    const sup = resolveTest({ actor, kind: "skill", char: "wp", morale: true, suppressionTest: true });
    const fear = resolveTest({ actor, kind: "skill", char: "wp", morale: true });
    expect(sup.rerolls).toHaveLength(1);
    expect(fear.rerolls).toHaveLength(0);
  });
});

describe("rollMoraleTest / Подавление: флаг доходит до правил", () => {
  beforeEach(() => {
    resetCaptured();
    clearRuleSources();
    registerRuleSource("test", () => [{ id: "test.nerves", when: {},
      effects: [{ kind: "rollMode", target: "suppression", mode: "keepBest", rolls: 2, label: "Стальные Нервы" }] }]);
  });
  afterEach(() => clearRuleSources());

  const wpActor = () => ({
    id: "a1", name: "Стойкий", uuid: "Actor.a1", type: "character",
    system: { characteristics: { wp: { total: 40 } }, conditions: { pinned: false } },
    async update() {}, getFlag: () => undefined, setFlag: async () => {}
  });

  it("rollSuppressionTest — два кубика, берётся лучший", async () => {
    captured.dice = [90, 10]; // порог 40: 90 — провал, 10 — успех
    const a = wpActor();
    const { success } = await rollSuppressionTest(a, { mod: 0 });
    expect(success).toBe(true);
    expect(captured.chat.at(-1).content).toContain("Стальные Нервы");
  });

  it("rollMoraleTest без suppression (Страх/Шок) — переброса нет", async () => {
    captured.dice = [90];
    const r = await rollMoraleTest(wpActor(), 40, { affectsCommand: false });
    expect(r.usedReroll).toBe(false);
    expect(r.success).toBe(false);
  });

  it("rollMoraleTest с suppression: true — переброс есть", async () => {
    captured.dice = [90, 10];
    const r = await rollMoraleTest(wpActor(), 40, { affectsCommand: false, suppression: true });
    expect(r.usedReroll).toBe(true);
    expect(r.success).toBe(true);
  });

  it("тест на ПРЕОДОЛЕНИЕ Подавления (конец Хода) — не «тест на Подавление» книги, переброса нет", async () => {
    captured.dice = [90];
    const a = wpActor();
    a.system.conditions.pinned = true;
    const { success } = await rollSuppressionRecovery(a, { bonus: 0 });
    expect(success).toBe(false);
  });
});

describe("Nerves of Steel в паке", () => {
  const dir = path.resolve(import.meta.dirname, "../../packs-src/talents/Смелость");
  const doc = JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(f => f.startsWith("Nerves"))), "utf8"));
  const entries = (doc.flags[SYSTEM].mechanics ?? []).flatMap(g => g.entries ?? []);

  it("несёт один переброс с областью suppression", () => {
    expect(entries.map(e => [e.kind, e.rerollScope])).toEqual([["reroll", "suppression"]]);
  });

  it("заметка не «Не смоделировано»", () => {
    expect(doc.system.notes).not.toMatch(/^Не смоделировано/);
  });
});
