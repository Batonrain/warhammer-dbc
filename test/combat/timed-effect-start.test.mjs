// test/combat/timed-effect-start.test.mjs
//
// Живая проверка 13.11.2026 (Боевой Клич, Психический Рывок): эффект с таймером создавался без
// явного start, и ядро Foundry брало бой из трекера ГМа (game.combat) и «текущий» Ход, а не бой
// и Ход носителя. effectStartOf отдаёт старт в бою носителя.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { effectStartOf, timedEffectData } from "../../module/combat/timed-effects.mjs";

const actor = { id: "a1" };
const fighters = [{ id: "c1" }, { id: "c2" }, { id: "c3", initiative: 12 }];
const combatDoc = (over = {}) => ({
  id: "B", started: true, round: 2, turns: fighters,
  getCombatantsByActor: a => (a === actor ? [fighters[2]] : []), ...over
});

const setGame = combats => { globalThis.game = { ...(globalThis.game || {}), combats: { get: id => combats[id] }, time: { worldTime: 500 } }; };

describe("effectStartOf — старт эффекта в бою носителя", () => {
  const saved = globalThis.game;
  afterEach(() => { globalThis.game = saved; });

  it("бой, участник-носитель и его Ход в очереди", () => {
    setGame({ B: combatDoc() });
    expect(effectStartOf(actor, { id: "B" })).toEqual({
      time: 500, combat: "B", combatant: "c3", initiative: 12, round: 2, turn: 2
    });
  });

  it("бой не начат или не найден — null, ядро заполнит старт само", () => {
    setGame({ B: combatDoc({ started: false }) });
    expect(effectStartOf(actor, { id: "B" })).toBeNull();
    expect(effectStartOf(actor, { id: "нет" })).toBeNull();
    expect(effectStartOf(actor, null)).toBeNull();
  });

  it("носитель не участник боя — combatant и turn пустые, бой верный", () => {
    setGame({ B: combatDoc() });
    const s = effectStartOf({ id: "чужой" }, { id: "B" });
    expect(s.combat).toBe("B");
    expect(s.combatant).toBeNull();
    expect(s.turn).toBeNull();
  });
});

describe("timedEffectData — start", () => {
  const base = { key: "k", name: "n", changes: [] };
  it("start попадает в данные эффекта", () => {
    const start = { combat: "B", round: 2, turn: 2 };
    expect(timedEffectData({ ...base, start }).start).toEqual(start);
  });
  it("без start поля нет — как раньше", () => {
    expect("start" in timedEffectData(base)).toBe(false);
  });
});

// dbc-78 / wdbc-p95ph: Боевой Клич вне боя — ядро гасило эффект «на 1 Раунд»
// по Календарю через секунды. Вне начатого боя срок — бессрочный, снимает
// подметание в начале Хода носителя.
import { grantTimedEffect, OUT_OF_COMBAT_DURATION } from "../../module/combat/timed-effects.mjs";
describe("grantTimedEffect вне боя", () => {
  const saved = globalThis.game;
  afterEach(() => { globalThis.game = saved; });
  it("без начатого боя — эффект без срока", async () => {
    globalThis.game = { ...(saved || {}), combat: null, combats: { get: () => null, contents: [], [Symbol.iterator]: function* () {} }, time: { worldTime: 1 } };
    const created = [];
    const a = { id: "a1", effects: [], getActiveTokens: () => [],
      createEmbeddedDocuments: async (_t, list) => { created.push(...list); return list; } };
    await grantTimedEffect(a, { key: "warCry", name: "Клич", keepOutOfCombat: true, changes: [{ key: "system.fearRating", value: 1 }] });
    expect(created[0].duration).toEqual(OUT_OF_COMBAT_DURATION);
    expect("start" in created[0]).toBe(false);
  });
  it("без флага keepOutOfCombat (Калибровка, Горячечная Скорость) — срок 1 Раунд, не бессрочный", async () => {
    globalThis.game = { ...(saved || {}), combat: null, combats: { get: () => null, contents: [], [Symbol.iterator]: function* () {} }, time: { worldTime: 1 } };
    const created = [];
    const a = { id: "a1", effects: [], getActiveTokens: () => [],
      createEmbeddedDocuments: async (_t, list) => { created.push(...list); return list; } };
    await grantTimedEffect(a, { key: "feverAgility", name: "Горячка", changes: [{ key: "system.characteristics.ag.bonusFx", value: 2 }] });
    expect(created[0].duration).toEqual({ value: 1, units: "rounds", expiry: "turnStart" });
  });
});
