// test/rules/warp-touched.test.mjs
//
// Warp-Touched / Затронутый Варпом (wdbc-1rno.26), чистая часть двух
// субмутаций (книга, «95 | Затронутый Варпом»):
//  1 — «считает всех врагов в Ярости имеющими рейтинг Страха 3»;
// 10 — «после получения любого лечения, кроме как от себя, штраф −10 на все
//      тесты, кроме тестов Т, на 1 час».

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import {
  rageFearRating, relationByDisposition, healMistrustRules, healMistrustUntil, isHealedByOther,
  HEAL_MISTRUST_FLAG, HEAL_MISTRUST_SECONDS
} from "../../module/rules/warp-touched.mjs";
import { autoTestMods } from "../../module/rules/roll-mods.mjs";

describe("Страх Ярости (субмутация 1)", () => {
  it("враг в Ярости без своего Страха — Страх 3", () => {
    expect(rageFearRating(0, { sourceInRage: true, relation: "enemy" })).toBe(3);
  });

  it("свой Страх выше 3 не понижается", () => {
    expect(rageFearRating(4, { sourceInRage: true, relation: "enemy" })).toBe(4);
  });

  it("не в Ярости — свой рейтинг как есть", () => {
    expect(rageFearRating(1, { sourceInRage: false, relation: "enemy" })).toBe(1);
  });

  it("союзник в Ярости — не враг, Страха не прибавляет", () => {
    expect(rageFearRating(0, { sourceInRage: true, relation: "ally" })).toBe(0);
  });

  it("отношение неизвестно (нет токенов) — источник выбран игроком как угроза, Страх 3", () => {
    expect(rageFearRating(0, { sourceInRage: true, relation: "neutral" })).toBe(3);
  });

  it("отношение по диспозициям токенов: противоположные — враг, равные — союзник, нейтральный — никто", () => {
    expect(relationByDisposition(1, -1)).toBe("enemy");
    expect(relationByDisposition(-1, -1)).toBe("ally");
    expect(relationByDisposition(1, 0)).toBe("neutral");
    expect(relationByDisposition(undefined, -1)).toBe("neutral");
  });
});

describe("Недоверие к Лечению (субмутация 10)", () => {
  const actor = until => ({ flags: { "warhammer-dbc": { [HEAL_MISTRUST_FLAG]: until } } });

  it("срок — ровно час игрового времени", () => {
    expect(HEAL_MISTRUST_SECONDS).toBe(3600);
    expect(healMistrustUntil(1000)).toBe(4600);
  });

  it("метки нет — правила нет", () => {
    expect(healMistrustRules({ flags: {} }, 1000)).toEqual([]);
  });

  it("час не истёк — −10 автоматом на все тесты, кроме T", () => {
    const [rule] = healMistrustRules(actor(4600), 1000);
    expect(rule.when).toEqual({ charNotIn: ["t"] });
    expect(rule.effects).toEqual([expect.objectContaining({ kind: "rollBonus", target: "all", value: -10, auto: true })]);
  });

  it("час истёк — правила нет", () => {
    expect(healMistrustRules(actor(4600), 4600)).toEqual([]);
  });

  it("лечение от себя не считается, от другого — считается", () => {
    const a = { uuid: "Actor.a" }, b = { uuid: "Actor.b" };
    expect(isHealedByOther(a, a)).toBe(false);
    expect(isHealedByOther(a, { uuid: "Actor.a" })).toBe(false);
    expect(isHealedByOther(b, a)).toBe(true);
    expect(isHealedByOther(null, a)).toBe(false);
  });

  it("свой несвязанный токен в цели — тот же персонаж (id совпадает), не «другой»", () => {
    const sheet = { id: "x", uuid: "Actor.x" };
    const ownToken = { id: "x", uuid: "Scene.s.Token.t.Actor.x" };
    expect(isHealedByOther(sheet, ownToken)).toBe(false);
    expect(isHealedByOther({ id: "y", uuid: "Actor.y" }, ownToken)).toBe(true);
  });
});

// Через настоящий реестр (rules/sources.mjs, источник warpTouchedHealMistrust):
// штраф доезжает до Порога любого теста сам, без галочки, и обходит тесты T.
describe("Недоверие к Лечению в Пороге теста (реестр правил)", () => {
  afterEach(() => { game.time = undefined; });
  const patient = until => ({
    type: "character", name: "Пациент", items: [],
    system: { characteristics: {} },
    flags: { "warhammer-dbc": { [HEAL_MISTRUST_FLAG]: until } },
    getFlag(ns, key) { return this.flags[ns]?.[key]; }
  });

  it("тест W в пределах часа — −10", () => {
    game.time = { worldTime: 1000 };
    expect(autoTestMods(patient(4600), { kind: "skill", char: "wp" }).total).toBe(-10);
  });

  it("атака (WS) в пределах часа — тоже −10: «все тесты»", () => {
    game.time = { worldTime: 1000 };
    expect(autoTestMods(patient(4600), { kind: "attack", char: "ws" }).total).toBe(-10);
  });

  it("тест T — без штрафа", () => {
    game.time = { worldTime: 1000 };
    expect(autoTestMods(patient(4600), { kind: "skill", char: "t" }).total).toBe(0);
  });

  it("час прошёл — без штрафа", () => {
    game.time = { worldTime: 5000 };
    expect(autoTestMods(patient(4600), { kind: "skill", char: "wp" }).total).toBe(0);
  });
});
