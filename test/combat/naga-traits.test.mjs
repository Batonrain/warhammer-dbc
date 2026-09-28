// test/combat/naga-traits.test.mjs
//
// Черты Наги в живых путях системы: Удав в Борьбе, Кровотечение в начале
// Хода, Toxic и яды-препараты при иммунитете к ядам, пост-эффекты и
// Зависимость, +1 Рана в сутки, пороги Inf Дитя Тёмного Принца и
// неснимаемый Покровитель. Возможности выдаются тестовым источником правил —
// тем же grantFlag, что даёт запись Конструктора на Черте.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import {
  resolveGrappleSuccess, grappleHands, grappleTechDef, grappleTestMods, isTailHold,
  _resolveTakeoverSuccess, endGrapple, setGrappleHands
} from "../../module/combat/grapple.mjs";
import { handsOccupied } from "../../module/rules/hands.mjs";
import { processConditionTurnStart } from "../../module/combat/condition-ticks.mjs";
import { rollAddictionTest, triggerAfterEffect, applyDrug } from "../../module/sheets/tabs/drugs.mjs";
import {
  extraWoundDailyClock, checkDarkPrinceMilestones, enforceLockedPatron, grantLockedPatron
} from "../../module/apps/naga-traits.mjs";
import { SECONDS_PER_DAY } from "../../module/rules/naga-traits.mjs";

const { _applyWeaponPropEffect } = await import("../../module/hooks.mjs");

const DEFAULT_SOURCES = getRuleSources();
const grant = (...flags) => registerRuleSource("test.naga", () => flags.map(f => ({
  id: `test.${f}`, label: "Изуверская Физиология", effects: [{ kind: "grantFlag", target: f }] })));

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { ...globalThis.game.user, id: "user-1", isGM: true, targets: new Set() };
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

/** Актор, разбирающий flags.* и -= в update, как Foundry. */
function actorOf(name, uuid, system = {}, items = []) {
  const flags = {};
  const a = {
    id: uuid, name, uuid, type: "character", items, isOwner: true, hasPlayerOwner: false,
    system: { conditions: {}, sizeTotal: 1, meleeStance: "standard", encumbrance: { carry: 0 },
      actionPoints: { value: 2, max: 2 }, skills: {}, ...system },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async changes => {
      captured.updates.push(changes);
      for (const [path, v] of Object.entries(changes)) {
        let m = path.match(/^flags\.[^.]+\.-=(.+)$/);
        if (m) { delete flags[m[1]]; continue; }
        m = path.match(/^flags\.[^.]+\.(.+)$/);
        if (m) { flags[m[1]] = v; continue; }
        const keys = path.split(".");
        let node = a;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = v;
      }
      return changes;
    },
    getActiveTokens: () => [],
    _flags: flags
  };
  return a;
}

describe("Удав: хвост в Захвате", () => {
  async function tailGrapple() {
    grant("grapple.constrictorTail");
    const naga = actorOf("Нага", "Actor.n", { characteristics: { s: { total: 30, bonus: 3 }, ag: { total: 30 } } });
    const held = actorOf("Жертва", "Actor.v", { sizeTotal: 1, characteristics: { s: { total: 30, bonus: 3 } } });
    const byUuid = { [naga.uuid]: naga, [held.uuid]: held };
    globalThis.fromUuidSync = u => byUuid[u] ?? null;
    globalThis.fromUuid = async u => byUuid[u] ?? null;
    await resolveGrappleSuccess(naga, { target: held });
    return { naga, held };
  }

  it("держит хвостом: «пара рук» — 2 броска, 4 руки цели, свои руки свободны", async () => {
    const { naga, held } = await tailGrapple();
    expect(isTailHold(naga)).toBe(true);
    expect(grappleHands(naga)).toBe(2);
    expect(held._flags.grappleHeldHands).toBe(4);
    expect(handsOccupied(naga).used).toBe(0);
    expect(grappleTechDef(naga, { label: "Заломить", defaultChar: "s" }).rollCount).toBe(2);
  });

  it("+20 к Athletics в Борьбе и в сопротивлении, но не к Acrobatics «Выкрутиться»", async () => {
    const { naga, held } = await tailGrapple();
    expect(grappleTestMods(naga, held)).toContainEqual({ label: "Хвост Удава", value: 20 });
    expect(grappleTechDef(naga, { label: "Заломить", defaultChar: "s" }).extraBonus).toBe(20);
    expect(grappleTechDef(naga, { label: "Выкрутиться", defaultChar: "ag" }).extraBonus).toBe(0);
    // Жертва пытается вырваться — Нага сопротивляется Athletics с +20.
    expect(grappleTechDef(held, { label: "Вырваться", defaultChar: "s" }).resistMods(naga, held))
      .toContainEqual({ label: "Хвост Удава", value: 20 });
  });

  it("свои руки — сверх хвоста; меньше хвоста не бывает", async () => {
    const { naga, held } = await tailGrapple();
    expect(await setGrappleHands(naga, 3)).toBe(3);
    expect(held._flags.grappleHeldHands).toBe(6);
    expect(handsOccupied(naga).used).toBe(1);
    expect(await setGrappleHands(naga, 1)).toBe(2);
  });

  it("без Черты — обычная рука", async () => {
    const holder = actorOf("Человек", "Actor.h", { characteristics: { s: { total: 30, bonus: 3 } } });
    const held = actorOf("Жертва", "Actor.v2");
    const byUuid = { [holder.uuid]: holder, [held.uuid]: held };
    globalThis.fromUuidSync = u => byUuid[u] ?? null;
    await resolveGrappleSuccess(holder, { target: held });
    expect(isTailHold(holder)).toBe(false);
    expect(grappleHands(holder)).toBe(1);
    expect(held._flags.grappleHeldHands).toBe(2);
    expect(grappleTestMods(holder, held)).toEqual([]);
  });

  it("Перехватить Контроль у Наги: хвост уже не держит; конец Борьбы снимает метку", async () => {
    const { naga, held } = await tailGrapple();
    await _resolveTakeoverSuccess(held);
    expect(isTailHold(naga)).toBe(false);
    await _resolveTakeoverSuccess(naga);
    expect(isTailHold(naga)).toBe(true);
    await endGrapple(naga);
    expect(isTailHold(naga)).toBe(false);
  });
});

describe("Изуверская Физиология: Кровотечение в начале Хода", () => {
  it("тест T+0 катается сам; успех снимает Кровотечение", async () => {
    grant("bleeding.selfStanchTurnStart");
    const naga = actorOf("Нага", "Actor.n", { characteristics: { t: { total: 35 } }, conditions: { bleeding: true } });
    captured.nextRoll = 20;
    await processConditionTurnStart(naga);
    expect(naga.system.conditions.bleeding).toBe(false);
    expect(captured.chat.at(-1).content).toContain("Кровотечение остановлено");
  });

  it("провал — кровь не унялась, Кровотечение остаётся", async () => {
    grant("bleeding.selfStanchTurnStart");
    const naga = actorOf("Нага", "Actor.n", { characteristics: { t: { total: 35 } }, conditions: { bleeding: true } });
    captured.nextRoll = 90;
    await processConditionTurnStart(naga);
    expect(naga.system.conditions.bleeding).toBe(true);
    expect(captured.chat.at(-1).content).toContain("не унялась");
  });

  it("без Черты теста нет", async () => {
    const human = actorOf("Человек", "Actor.h", { characteristics: { t: { total: 35 } }, conditions: { bleeding: true } });
    await processConditionTurnStart(human);
    expect(captured.chat.map(m => m.content).join("")).not.toContain("Затянуть Кровотечение");
  });
});

describe("Изуверская Физиология: иммунитет к ядам (Toxic)", () => {
  const toxic = actor => _applyWeaponPropEffect({
    wpForceActorUuid: actor.uuid, wpLabel: "Токсичное", wpKey: "toxic",
    wpCondition: "poisoned", wpTestChar: "t", wpDeg: "0", wpDmg: "1d10"
  });

  it("ни теста, ни Отравления, ни урона — карточка говорит, почему", async () => {
    grant("poison.immune");
    const naga = actorOf("Нага", "Actor.n", { characteristics: { t: { total: 35 } }, wounds: { value: 10, max: 10 } });
    globalThis.fromUuid = async () => naga;
    captured.nextRoll = 99;
    await toxic(naga);
    expect(captured.updates).toEqual([]);
    expect(captured.chat.at(-1).content).toContain("иммунитет к ядам");
  });

  it("без иммунитета — обычный тест сопротивления", async () => {
    const human = actorOf("Человек", "Actor.h", { characteristics: { t: { total: 35 } }, wounds: { value: 10, max: 10 } });
    globalThis.fromUuid = async () => human;
    captured.nextRoll = 99;
    await toxic(human);
    expect(captured.chat.at(-1).content).toContain("Порог");
  });
});

describe("Изуверская Физиология: наркотики и яды-препараты", () => {
  const drug = (system = {}) => {
    const item = { name: "Яд", system: { quantity: 2, drugCategory: "poison", specialEffects: {}, ...system },
      updates: [], update: async u => { item.updates.push(u); } };
    return item;
  };

  it("яд-препарат не действует, доза тратится", async () => {
    grant("poison.immune");
    const naga = actorOf("Нага", "Actor.n", { characteristics: { t: { total: 35 } } });
    const poison = drug({ specialEffects: { grantsCondition: "poisoned" } });
    await applyDrug(naga, poison);
    expect(poison.updates).toEqual([{ "system.quantity": 1 }]);
    expect(captured.updates).toEqual([]);
    expect(captured.chat.at(-1).content).toContain("Яд не действует");
  });

  it("тест Зависимости не нужен", async () => {
    grant("drugs.afterEffectAddictionImmune");
    const naga = actorOf("Нага", "Actor.n", { characteristics: { t: { total: 35 } } });
    await rollAddictionTest(naga, { name: "Обскура" });
    expect(captured.chat.at(-1).content).toContain("Зависимость невозможна");
    expect(captured.updates).toEqual([]);
  });

  it("пост-эффект не наступает — действие просто кончается", async () => {
    grant("drugs.afterEffectAddictionImmune");
    const naga = actorOf("Нага", "Actor.n", { characteristics: { t: { total: 35 } } });
    const item = drug({ drugCategory: "narcotic", hasAfterEffect: true, afterEffectSpecial: { grantsCondition: "fatigued" } });
    await triggerAfterEffect(naga, item);
    expect(item.updates.at(-1)).toMatchObject({ "system.activeEffect.isActive": false, "system.activeEffect.isAfterEffect": false });
    expect(captured.chat.at(-1).content).toContain("Пост-эффект не наступает");
  });
});

describe("Изуверская Физиология: +1 Рана в сутки по Календарю", () => {
  it("первая прокрутка ставит метку, через двое суток — +2 Раны", async () => {
    grant("healing.extraWoundDaily");
    const naga = actorOf("Нага", "Actor.n", { wounds: { value: 5, max: 10, critical: 0 } });
    await extraWoundDailyClock(naga, { from: 0, to: 1000 });
    expect(naga._flags.extraWoundDailyAt).toBe(1000);
    expect(naga.system.wounds.value).toBe(5);
    await extraWoundDailyClock(naga, { from: 1000, to: 1000 + 2 * SECONDS_PER_DAY });
    expect(naga.system.wounds.value).toBe(7);
    expect(captured.chat.at(-1).content).toContain("восстановлено Ран: <b>2</b>");
  });

  it("без Черты часы молчат", async () => {
    const human = actorOf("Человек", "Actor.h", { wounds: { value: 5, max: 10, critical: 0 } });
    await extraWoundDailyClock(human, { from: 0, to: 5 * SECONDS_PER_DAY });
    expect(captured.updates).toEqual([]);
  });
});

describe("Дитя Тёмного Принца", () => {
  it("Покровитель ставится сам и не меняется", async () => {
    grant("patronage.lockedSlaanesh");
    const naga = actorOf("Нага", "Actor.n", { patronGod: "" });
    await grantLockedPatron(naga);
    expect(naga.system.patronGod).toBe("slaanesh");
    const changes = { system: { patronGod: "khorne" } };
    expect(enforceLockedPatron(naga, changes)).toBe(true);
    expect(changes.system.patronGod).toBeUndefined();
  });

  it("без Черты Покровителя менять можно", () => {
    const human = actorOf("Человек", "Actor.h", { patronGod: "slaanesh" });
    const changes = { system: { patronGod: "khorne" } };
    expect(enforceLockedPatron(human, changes)).toBe(false);
    expect(changes.system.patronGod).toBe("khorne");
  });

  it("30 Inf: выбор «+2 к максимуму Очков Бесчестия» пишется и больше не спрашивается", async () => {
    grant("infamy.darkPrinceMilestones");
    const naga = actorOf("Нага", "Actor.n", { characteristics: { inf: { total: 31 } }, infamyMaxMod: 0 });
    const pending = checkDarkPrinceMilestones(naga);
    await new Promise(r => setTimeout(r, 0));
    await captured.press("infamy");
    await pending;
    expect(naga.system.infamyMaxMod).toBe(2);
    expect(naga._flags.darkPrinceMilestones).toEqual([30]);
    captured.dialog = null;
    await checkDarkPrinceMilestones(naga);
    expect(captured.dialog).toBeNull();
  });

  it("выбор «руки» поднимает рейтинг Многорукого на 2 и помнит свой вклад", async () => {
    grant("infamy.darkPrinceMilestones");
    const arms = { type: "trait", name: "Multiple Arms / Многорукий (X)", system: { rating: 4 }, flags: {},
      getFlag: () => undefined, update: async u => { arms.lastUpdate = u; } };
    const naga = actorOf("Нага", "Actor.n", { characteristics: { inf: { total: 30 } } }, [arms]);
    const pending = checkDarkPrinceMilestones(naga);
    await new Promise(r => setTimeout(r, 0));
    await captured.press("arms");
    await pending;
    expect(arms.lastUpdate).toEqual({ "system.rating": 6, "flags.warhammer-dbc.dpcArms": 2 });
  });

  it("ниже 30 Inf окна нет", async () => {
    grant("infamy.darkPrinceMilestones");
    const naga = actorOf("Нага", "Actor.n", { characteristics: { inf: { total: 29 } } });
    await checkDarkPrinceMilestones(naga);
    expect(captured.dialog).toBeNull();
  });
});
