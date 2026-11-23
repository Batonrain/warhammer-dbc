// Герольд: дары соратникам «до конца боя/сцены», знамя Ни Шагу Назад (21.11.2026).
import { describe, it, expect, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { boonString, parseBoon, boonAlive, aliveBoons, boonRules, skillTestValue } from "../../module/rules/astartes-elite-common.mjs";
import { bannerRadius, metersBetween, defendsBanner, standYourGroundRules } from "../../module/rules/gerold-talents.mjs";
import { astartesEliteRules } from "../../module/rules/astartes-elite-rules.mjs";

describe("дары соратникам", () => {
  it("строка дара туда и обратно", () => {
    const s = boonString({ combatId: "c1", sceneId: "s1", value: -10, label: "Знамя | осквернено" });
    expect(parseBoon(s)).toEqual({ combatId: "c1", sceneId: "s1", value: -10, label: "Знамя / осквернено" });
  });
  it("выдан в бою — жив только в том же бою; вне боя — в той же сцене", () => {
    expect(boonAlive({ combatId: "c1", sceneId: "s1" }, { combatId: "c1" })).toBe(true);
    expect(boonAlive({ combatId: "c1", sceneId: "s1" }, { combatId: "" , sceneId: "s1" })).toBe(false);
    expect(boonAlive({ combatId: "", sceneId: "s1" }, { sceneId: "s1" })).toBe(true);
    expect(boonAlive({ combatId: "", sceneId: "s1" }, { sceneId: "s2" })).toBe(false);
  });
  it("morale даёт авто-±, herald — Преимущество на Command/Charm/Intimidate", () => {
    const actor = { flags: { "warhammer-dbc": { astartesBoon: {
      morale: boonString({ sceneId: "s1", value: 10, label: "Честь Злодеев" }),
      herald: boonString({ sceneId: "s1", label: "Высший Герольд" })
    } } } };
    const boons = aliveBoons(actor, { combatId: "", sceneId: "s1" });
    const rules = boonRules(boons);
    expect(rules[0].effects[0]).toMatchObject({ kind: "rollBonus", target: "all", value: 10, auto: true });
    expect(rules[1].effects[0]).toMatchObject({ kind: "rollMode", mode: "keepBest", target: ["skill:command", "skill:charm", "skill:intimidate"] });
    expect(boonRules(aliveBoons(actor, { sceneId: "другая" }))).toEqual([]);
  });
});

describe("значение теста Навыка", () => {
  const actor = { system: {
    characteristics: { int: { total: 40 }, wp: { total: 50 }, per: { total: 35 } },
    skills: { awareness: { total: 45 } },
    groupSkills: { forbiddenLore: [{ specialty: "Heresy", total: 50 }] }
  } };
  it("групповой на другой Характеристике: ранг поверх W", () => {
    expect(skillTestValue(actor, { group: "forbiddenLore", spec: /heresy/i, char: "wp" })).toMatchObject({ value: 60, char: "wp", trained: true });
  });
  it("нетренированный — −20", () => {
    expect(skillTestValue(actor, { group: "navigation", spec: /warp/i }).value).toBe(20);
  });
  it("обычный Навык — его итог", () => expect(skillTestValue(actor, { skill: "awareness" }).value).toBe(45));
});

describe("Ни Шагу Назад", () => {
  afterEach(() => { delete globalThis.canvas; });
  const herald = { uuid: "Actor.h", name: "Герольд", system: { characteristics: { wp: { bonus: 4 } } },
    items: [{ type: "talent", name: "Stand Your Ground / Ни Шагу Назад" }],
    flags: { "warhammer-dbc": { standYourGround: { sceneId: "s1", x: 0, y: 0 } } } };
  it("радиус W.b×2 и метры по сетке", () => {
    expect(bannerRadius(herald)).toBe(8);
    expect(metersBetween({ x: 0, y: 0 }, { x: 300, y: 400 }, { size: 100, distance: 1 })).toBe(5);
  });
  it("защищает позицию только своя сторона в радиусе той же сцены", () => {
    const o = { disposition: 1, radius: 8, sceneId: "s1", grid: { size: 100, distance: 1 } };
    expect(defendsBanner({ x: 500, y: 0, disposition: 1 }, herald.flags["warhammer-dbc"].standYourGround, o)).toBe(true);
    expect(defendsBanner({ x: 900, y: 0, disposition: 1 }, herald.flags["warhammer-dbc"].standYourGround, o)).toBe(false);
    expect(defendsBanner({ x: 100, y: 0, disposition: -1 }, herald.flags["warhammer-dbc"].standYourGround, o)).toBe(false);
  });
  it("соратник у знамени получает Преимущество на тесты Морали", () => {
    const ally = { uuid: "Actor.a", items: [], flags: {} };
    globalThis.canvas = { scene: { id: "s1", grid: { size: 100, distance: 1 } }, tokens: { placeables: [
      { actor: herald, center: { x: 0, y: 0 }, document: { disposition: 1 } },
      { actor: ally, center: { x: 300, y: 0 }, document: { disposition: 1 } }
    ] } };
    const rules = standYourGroundRules(ally);
    expect(rules[0].effects[0]).toMatchObject({ kind: "rollMode", target: "morale", mode: "keepBest" });
    expect(astartesEliteRules(ally).length).toBe(1);
  });
});
