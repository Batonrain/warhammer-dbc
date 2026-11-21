// test/rules/trophy-infamy.test.mjs
//
// Собиратель Трофеев (Черта Мастера Казней, Sahara task-0b3a): «Может тратить
// их как Очки Бесчестия, но только в тестах на выслеживание, преследование,
// или бой с вражескими офицерами, чемпионами, или чудовищами». Очки Трофеев
// предлагаются в окне «Чем заплатить?» (apps/infamy-points.mjs::
// spendFromInfamyPool) только при трате за тест такого вида; «офицер ли
// цель» — решение игрока и ГМа, подпись в окне.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { trophyInfamyTestEligible, trophyInfamyOption, infamyTestContext } from "../../module/rules/trophy-points.mjs";

const hunter = (value = 2, per = 4) => {
  const doc = {
    id: "h1", uuid: "Actor.h1", name: "Мастер Казней", type: "character",
    items: [{ type: "trait", name: "Trophy Taker / Собиратель Трофеев" }],
    system: { trophyPoints: { value, max: per }, fate: { value: 0 }, characteristics: { per: { bonus: per } }, resourcePools: {} },
    flags: {}
  };
  doc.update = async ch => {
    for (const [p, v] of Object.entries(ch)) {
      const ks = p.split("."); let n = doc;
      for (const k of ks.slice(0, -1)) n = (n[k] ??= {});
      n[ks.at(-1)] = v;
    }
  };
  return doc;
};

describe("какие тесты — «выслеживание, преследование, бой»", () => {
  it("Выживание и Внимательность (выслеживание), Атлетика/Акробатика/Скрытность/Вождение (преследование)", () => {
    for (const skill of ["survival", "awareness", "athletics", "acrobatics", "stealth"])
      expect(trophyInfamyTestEligible({ skill })).toBe(true);
    expect(trophyInfamyTestEligible({ skill: "", group: "operate" })).toBe(true);
  });
  it("бой: атака, Уклонение, Парирование", () => {
    expect(trophyInfamyTestEligible({ attack: true })).toBe(true);
    expect(trophyInfamyTestEligible({ skill: "dodge" })).toBe(true);
    expect(trophyInfamyTestEligible({ skill: "parry" })).toBe(true);
  });
  it("социальный тест, Логика, трата с полосы без теста — нет", () => {
    expect(trophyInfamyTestEligible({ skill: "charm" })).toBe(false);
    expect(trophyInfamyTestEligible({ skill: "logic" })).toBe(false);
    expect(trophyInfamyTestEligible(null)).toBe(false);
  });
});

describe("infamyTestContext — тест из флагов карточки", () => {
  it("skillTest и атака", () => {
    expect(infamyTestContext({ flags: { "warhammer-dbc": { skillTest: { skill: "survival", group: "" } } } }))
      .toEqual({ skill: "survival", group: "", attack: false });
    expect(infamyTestContext({ flags: { "warhammer-dbc": { attack: { actorId: "x" } } } }))
      .toEqual({ skill: "", group: "", attack: true });
    expect(infamyTestContext({ flags: {} })).toBeNull();
  });
});

describe("trophyInfamyOption", () => {
  it("есть очки и тест подходит — вариант с подписью ограничения", () => {
    const o = trophyInfamyOption(hunter(2), { skill: "survival" });
    expect(o).toMatchObject({ key: "trophy", label: "Очки Трофеев", asInfamyCor: null });
    expect(o.asInfamyNote).toMatch(/офицер/);
  });
  it("нет очков, нет Черты или тест не тот — null", () => {
    expect(trophyInfamyOption(hunter(0), { skill: "survival" })).toBeNull();
    expect(trophyInfamyOption(hunter(2), { skill: "charm" })).toBeNull();
    const a = hunter(2); a.items = [];
    expect(trophyInfamyOption(a, { skill: "survival" })).toBeNull();
  });
});

describe("spendFromInfamyPool: Очко Трофеев вместо Очка Бесчестия", () => {
  it("тест выслеживания, обычных Очков нет — платит Очко Трофеев", async () => {
    const { spendFromInfamyPool } = await import("../../module/apps/infamy-points.mjs");
    const a = hunter(2);
    const r = await spendFromInfamyPool(a, 1, "system.fate.value", { test: { skill: "survival" } });
    expect(r.resourceSpent).toMatchObject({ key: "trophy", amount: 1, after: 1 });
    expect(a.system.trophyPoints.value).toBe(1);
  });
  it("социальный тест или трата без теста — Трофеи не предлагаются", async () => {
    const { spendFromInfamyPool, infamyResourceAvailable } = await import("../../module/apps/infamy-points.mjs");
    const a = hunter(2);
    const r = await spendFromInfamyPool(a, 1, "system.fate.value", { test: { skill: "charm" } });
    expect(r.resourceSpent).toBeUndefined();
    expect(a.system.trophyPoints.value).toBe(2);
    expect(infamyResourceAvailable(a)).toBe(false);
    expect(infamyResourceAvailable(a, { test: { attack: true } })).toBe(true);
  });
});

// Очки Мести Ревенанта (Sahara 583-d28a): «как трата Очка Бесчестия на атаку».
// Трата из карточки НЕ-атакующего теста Местью не оплачивается; трата с полосы
// (теста нет — активация Таланта вроде Killing Strike) — по-прежнему можно.
describe("Месть как Бесчестие — только на атаку", () => {
  const revenant = () => {
    const doc = hunter(0);
    doc.items = [{ name: "Мстительный Дух", type: "trait", flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND",
      entries: [{ kind: "resourcePool", resPoolKey: "vengeance", resPoolMax: "3", resPoolAsInfamy: true }] }] } } }];
    doc.system.resourcePools = { vengeance: 2 };
    return doc;
  };
  it("тест Навыка — Месть не предлагается; атака и полоса — да", async () => {
    const { infamyResourceAvailable, spendFromInfamyPool } = await import("../../module/apps/infamy-points.mjs");
    const a = revenant();
    expect(infamyResourceAvailable(a, { test: { skill: "survival" } })).toBe(false);
    expect(infamyResourceAvailable(a, { test: { attack: true } })).toBe(true);
    expect(infamyResourceAvailable(a)).toBe(true);
    const r = await spendFromInfamyPool(a, 1, "system.fate.value", { test: { skill: "charm" } });
    expect(r.resourceSpent).toBeUndefined();
    expect(a.system.resourcePools.vengeance).toBe(2);
    const r2 = await spendFromInfamyPool(a, 1, "system.fate.value", { test: { attack: true } });
    expect(r2.resourceSpent).toMatchObject({ key: "vengeance" });
  });
});
