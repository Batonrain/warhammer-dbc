// test/combat/beastman-subrace.test.mjs
//
// wdbc-gao07. Субрасы Зверолюда: Кхорнгор (W+10 на Ярость при уроне),
// Мясник (запас кубиков по Hatred, ½W.b за попадание), Плакальщик Пестигора
// (раз за бой: непоглощённый урон → 1, T.b ×2 на Раунд).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  butcherPool, butcherPerHitCap, butcherUsed, butcherAvailable, damageDieFaces,
  mournerTbFactor, mournerCanReduce
} from "../../module/rules/beastman-subrace.mjs";
import { khorngorRageTest, mournerOffer, mournerTb, butcherStatus } from "../../module/combat/beastman-subrace.mjs";
import { registerRuleSource, clearRuleSources } from "../../module/rules/sources.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const hatred = tier => ({ type: "talent", name: "Hatred / Ненависть", system: { tier } });

describe("запас кубиков Мясника", () => {
  it("1 за Hatred 2-го уровня, 1 за каждые 2 Hatred 1-го", () => {
    expect(butcherPool({ items: [hatred(2), hatred(2), hatred(1)] })).toBe(2);
    expect(butcherPool({ items: [hatred(2), hatred(1), hatred(1), hatred(1)] })).toBe(2);
    expect(butcherPool({ items: [] })).toBe(0);
  });
  it("за попадание — до ½W.b (окр.▲); с учётом потраченного; в другом бою счёт заново", () => {
    expect(butcherPerHitCap({ system: { characteristics: { wp: { bonus: 5 } } } })).toBe(3);
    expect(butcherAvailable(4, 1, 3)).toBe(3);
    expect(butcherAvailable(4, 3, 3)).toBe(1);
    expect(butcherAvailable(2, 2, 3)).toBe(0);
    expect(butcherUsed({ combatId: "c1", used: 2 }, "c1")).toBe(2);
    expect(butcherUsed({ combatId: "c1", used: 2 }, "c2")).toBe(0);
  });
  it("кубик урона — первый «NdF» формулы, иначе d10", () => {
    expect(damageDieFaces("1d10+5")).toBe(10);
    expect(damageDieFaces("2d5")).toBe(5);
    expect(damageDieFaces("")).toBe(10);
  });
});

describe("Плакальщик: арифметика", () => {
  it("T.b ×2 пока срок не истёк; уменьшать можно только урон больше 1", () => {
    expect(mournerTbFactor(100, 50)).toBe(2);
    expect(mournerTbFactor(100, 100)).toBe(1);
    expect(mournerTbFactor(undefined, 5)).toBe(1);
    expect(mournerCanReduce(2)).toBe(true);
    expect(mournerCanReduce(1)).toBe(false);
  });
});

/** Актор с возможностями (rule source) и флагами. */
const flags = {};
function actor(extra = {}) {
  return {
    name: "Зверь", items: [], system: { inRage: false, characteristics: { wp: { total: 40, bonus: 4 } } },
    updates: [],
    getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async function (d) { this.updates.push(d); },
    ...extra
  };
}
const grant = key => registerRuleSource("test", () => [{ id: "t", when: {}, effects: [{ kind: "grantFlag", target: key }] }]);

beforeEach(() => {
  resetCaptured();
  for (const k of Object.keys(flags)) delete flags[k];
  globalThis.game.time = { worldTime: 1000 };
  globalThis.game.combat = { id: "c1", round: 1 };
  clearRuleSources();
});
afterEach(() => { clearRuleSources(); globalThis.game.combat = null; });

describe("данные пака: возможности едут с предметами", () => {
  it("субраса Кхорнгор, Мясник и Плакальщик несут свои возможности", () => {
    const sub = packDocById("packs-src/races/Субрасы", "DBpnsL5iimkOSDB1");
    const btc = packDocById("packs-src/talents/Субрасы_Зверолюдов", "mBwAymB0yjsFgRtu");
    const mrn = packDocById("packs-src/talents/Субрасы_Зверолюдов", "ZNsLdMnjBC5DSMcT");
    const keys = d => d.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys(sub)).toContain("subrace.khorngor.rage");
    expect(keys(btc)).toContain("talent.beastmanSubrace.khorngorButcher");
    expect(keys(mrn)).toContain("talent.beastmanSubrace.pestigorMourner");
  });
});

describe("Кхорнгор: Ярость от урона", () => {
  it("без возможности — ничего", async () => {
    const a = actor();
    await khorngorRageTest(a);
    expect(a.updates).toHaveLength(0);
  });
  it("проваленный тест W+10 — Ярость", async () => {
    grant("subrace.khorngor.rage");
    const a = actor();
    captured.confirmAnswer = false; captured.dice = [95];
    await khorngorRageTest(a);
    expect(a.updates.at(-1)).toEqual({ "system.inRage": true });
    expect(captured.chat.at(-1).content).toContain("впадает в Ярость");
  });
  it("успех W+10 (порог 50) — сдержался; уже в Ярости — теста нет", async () => {
    grant("subrace.khorngor.rage");
    const a = actor();
    captured.confirmAnswer = false; captured.dice = [45];
    await khorngorRageTest(a);
    expect(a.updates).toHaveLength(0);
    expect(captured.chat.at(-1).content).toContain("сдержался");
    const raging = actor({ system: { inRage: true, characteristics: { wp: { total: 40, bonus: 4 } } } });
    resetCaptured();
    await khorngorRageTest(raging);
    expect(captured.chat).toHaveLength(0);
  });
  it("намеренный провал — Ярость без броска", async () => {
    grant("subrace.khorngor.rage");
    const a = actor();
    captured.confirmAnswer = true;
    await khorngorRageTest(a);
    expect(a.updates.at(-1)).toEqual({ "system.inRage": true });
    expect(captured.chat.at(-1).content).toContain("Намеренно");
  });
});

describe("Плакальщик Пестигора", () => {
  it("предлагает, при согласии урон → 1, T.b ×2 в течение Раунда, раз за бой", async () => {
    grant("talent.beastmanSubrace.pestigorMourner");
    const a = actor();
    captured.confirmAnswer = true;
    const r = await mournerOffer(a, 7);
    expect(r.net).toBe(1);
    expect(r.note).toContain("→ 1");
    expect(mournerTb(a, 4)).toBe(8);
    globalThis.game.time.worldTime = 1000 + 100;
    expect(mournerTb(a, 4)).toBe(4);
    // Повторно в этом бою — не предлагается.
    const again = await mournerOffer(a, 9);
    expect(again.net).toBe(9);
  });
  it("отказ или урон 1 — без изменений; без возможности — тоже", async () => {
    grant("talent.beastmanSubrace.pestigorMourner");
    const a = actor();
    captured.confirmAnswer = false;
    expect((await mournerOffer(a, 5)).net).toBe(5);
    captured.confirmAnswer = true;
    expect((await mournerOffer(a, 1)).net).toBe(1);
    clearRuleSources();
    expect((await mournerOffer(actor(), 5)).net).toBe(5);
  });
});

describe("Мясник: состояние запаса", () => {
  it("с возможностью — запас и остаток; без — нули", () => {
    expect(butcherStatus(actor())).toEqual({ pool: 0, used: 0, cap: 0, left: 0 });
    grant("talent.beastmanSubrace.khorngorButcher");
    const a = actor({ items: [hatred(2), hatred(2), hatred(2)] });
    expect(butcherStatus(a)).toMatchObject({ pool: 3, used: 0, cap: 2, left: 2 });
    flags.butcherDice = { combatId: "c1", used: 2 };
    expect(butcherStatus(a)).toMatchObject({ used: 2, left: 1 });
    globalThis.game.combat = { id: "c2" };
    expect(butcherStatus(a)).toMatchObject({ used: 0, left: 2 });
  });
});

import { attackCard } from "../../module/combat/attack-card.mjs";

describe("карточка попадания: кнопка Мясника", () => {
  const base = {
    actorName: "Кхорнгор", weaponName: "Когти", wp: {}, threshold: 45, rv: 23, modeLine: "Одиночный",
    hit: true, deg: 2, hitsCount: 1, hits: [{ total: 8, loc: "Торс" }], hitLocLabel: "Торс", locRoll: 32,
    dtLabel: "Рубящий", pen: 0, attackerUuid: "Actor.k", itemUuid: "Item.c", isMelee: true
  };
  it("есть кубики — кнопка с остатком; нет — без кнопки", () => {
    const html = attackCard({ ...base, butcherDice: 2 });
    expect(html).toContain("wh-butcher-btn");
    expect(html).toContain("до 2");
    expect(html).toContain('data-weapon-uuid="Item.c"');
    expect(attackCard(base)).not.toContain("wh-butcher-btn");
  });
});
