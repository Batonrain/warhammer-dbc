// test/rules/pariah-void-tails.test.mjs
//
// Хвосты Пустоты Парии (task-1452): Мораль (переброс успеха, автоуспехи у
// псайкеров/демонов), Нестабильность каждый Ход, Ритуалы, касание, «души».

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerRuleSource, clearRuleSources } from "../../module/rules/sources.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import {
  PARIAH_VOID, PARIAH_SELF, voidRerollsMorale, voidStripsMoraleAuto, voidInstabilityPenalty,
  voidBreaksRitual, ritualVoidBreak, pariahTouchOutcome, isSoullessActor
} from "../../module/rules/null-zones.mjs";
import { moraleAutoPass } from "../../module/rules/morale-auto.mjs";
import { rollMoraleTest } from "../../module/rules/morale-test.mjs";
import { pariahVoidMoraleReroll } from "../../module/rules/pariah-morale.mjs";
import { instabilityTestNeeded } from "../../module/rules/warp-instability.mjs";
import { PREDICATES } from "../../module/rules/predicates.mjs";
import { NULL_ZONE_RULES } from "../../module/rules/library/null-zones.mjs";
import { checkTargetWrite } from "../../module/combat/gm-relay.mjs";
import { ELITE_SCRIPT_API } from "../../module/combat/elite-api/index.mjs";
import { FEARLESS_CAP } from "../../module/rules/courage-talents.mjs";

const PARIAH_TRAIT = packDocById("packs-src/traits/Трейты_рас", "x8rVwVWA6EabOqsv");

// Флаги актора раздаются источником правил по имени актора.
let flagsByActor = {};
function useFlags(map) {
  flagsByActor = map;
  clearRuleSources();
  registerRuleSource("test", () => Object.entries(flagsByActor).flatMap(([name, keys]) =>
    keys.map((f, i) => ({ id: `test.${name}.${i}`, when: { actorName: name }, effects: [{ kind: "grantFlag", target: f }] }))));
}

function person(name, { wp = 40, pr = 0, type = "character", traits = [] } = {}) {
  const items = traits.map((n, i) => ({ id: `t${i}`, name: n, type: "trait", system: {} }));
  const flags = {};
  return {
    id: name, name, uuid: `Actor.${name}`, type, items, effects: [],
    system: { psyker: { rating: pr }, characteristics: { wp: { total: wp }, t: { total: 40, bonus: 4 } },
              fatigue: { value: 0, max: 0 }, conditions: {} },
    getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async d => d
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.settings = { get: () => "publicroll" };
  // Предикат actorName — для раздачи флагов поштучно в этом файле.
  PREDICATES.actorName ??= (actor, ctx, value) => actor?.name === value;
});
afterEach(() => { clearRuleSources(); delete PREDICATES.actorName; });

describe("Мораль в Пустоте", () => {
  it("перебрасывают все, кроме Парии", () => {
    useFlags({ Боец: [PARIAH_VOID], Пария: [PARIAH_VOID, PARIAH_SELF] });
    expect(voidRerollsMorale(person("Боец"))).toBe(true);
    expect(voidRerollsMorale(person("Пария"))).toBe(false);
    expect(voidRerollsMorale(person("Вне"))).toBe(false);
  });

  it("успех перебрасывается, остаётся второй бросок; провал — нет", async () => {
    captured.dice = [30];
    const ok = await pariahVoidMoraleReroll({ roll: { total: 10 }, rv: 10, rolls: [], rerollNote: "" }, 40, true);
    expect(ok.voidRerolled).toBe(true);
    expect(ok.rv).toBe(30);
    expect(ok.rerollNote).toMatch(/Пустота Парии/);
    const fail = await pariahVoidMoraleReroll({ roll: { total: 90 }, rv: 90, rolls: [], rerollNote: "" }, 40, true);
    expect(fail.voidRerolled).toBe(false);
    expect(fail.rv).toBe(90);
  });

  it("rollMoraleTest в Пустоте: успех 10 перебрасывается в провал 95", async () => {
    useFlags({ Боец: [PARIAH_VOID] });
    captured.dice = [10, 95];
    const r = await rollMoraleTest(person("Боец"), 40, { affectsCommand: false });
    expect(r.rv).toBe(95);
    expect(r.success).toBe(false);
  });

  it("контроль: вне Пустоты успех 10 остаётся", async () => {
    useFlags({});
    captured.dice = [10, 95];
    const r = await rollMoraleTest(person("Боец"), 40, { affectsCommand: false });
    expect(r.rv).toBe(10);
    expect(r.success).toBe(true);
  });

  it("псайкер и демон теряют автоуспех Бесстрашного, обычный человек — нет", () => {
    useFlags({ Псайкер: [PARIAH_VOID, FEARLESS_CAP], Демон: [PARIAH_VOID, FEARLESS_CAP], Боец: [PARIAH_VOID, FEARLESS_CAP] });
    const psy = person("Псайкер", { pr: 3 });
    const dmn = person("Демон", { type: "daemon" });
    expect(voidStripsMoraleAuto(psy)).toBe(true);
    expect(voidStripsMoraleAuto(dmn)).toBe(true);
    expect(moraleAutoPass(psy)).toBeNull();
    expect(moraleAutoPass(dmn)).toBeNull();
    expect(moraleAutoPass(person("Боец"))?.by).toBe("fearless");
  });
});

describe("Нестабильность демона в Пустоте", () => {
  it("тест каждый Ход, без урона", () => {
    expect(instabilityTestNeeded({ hurt: false, dealt: false, inVoid: true })).toBe(true);
    expect(instabilityTestNeeded({ hurt: true, dealt: true, inVoid: true })).toBe(true);
    expect(instabilityTestNeeded({ hurt: false, dealt: false })).toBe(false);
  });
  it("штраф — W сильнейшей Парии", () => {
    expect(voidInstabilityPenalty([35, 48])).toBe(-48);
    expect(voidInstabilityPenalty([])).toBe(-0);
  });
});

describe("Ритуалы", () => {
  it("Пария не участвует, ритуал в Пустоте обрывается", () => {
    useFlags({ Пария: [PARIAH_SELF, PARIAH_VOID], Колдун: [PARIAH_VOID] });
    expect(voidBreaksRitual(person("Пария"))).toBe("pariah");
    expect(voidBreaksRitual(person("Колдун"))).toBe("void");
    expect(voidBreaksRitual(person("Вне"))).toBeNull();
    expect(ritualVoidBreak(person("Вне"), [person("Пария")])?.reason).toBe("pariah");
    expect(ritualVoidBreak(person("Вне"), [person("Ещё")])).toBeNull();
  });
});

describe("Касание Парии", () => {
  it("исход по цели", () => {
    useFlags({ Пария2: [PARIAH_SELF] });
    expect(pariahTouchOutcome(person("Демон", { type: "daemon", pr: 4 }))).toEqual({ kind: "daemon", formula: "3d10" });
    expect(pariahTouchOutcome(person("Псайкер", { pr: 3 }))).toEqual({ kind: "psyker", formula: "3" });
    expect(pariahTouchOutcome(person("Боец"))).toEqual({ kind: "human", testMod: -10 });
    expect(pariahTouchOutcome(person("Пария2")).kind).toBe("none");
    expect(pariahTouchOutcome(person("Танк", { type: "vehicle" })).kind).toBe("none");
  });

  it("сокет: только Пария, только по псайкеру/демону, урон 1…30", () => {
    useFlags({ Пария: [PARIAH_SELF] });
    const pariah = person("Пария");
    const ctx = t => ({ initiatorOwned: true, initiator: pariah, target: t });
    expect(checkTargetWrite({ kind: "pariahTouch", amount: 12 }, ctx(person("Д", { type: "daemon" }))).ok).toBe(true);
    expect(checkTargetWrite({ kind: "pariahTouch", amount: 12 }, ctx(person("Боец"))).ok).toBe(false);
    expect(checkTargetWrite({ kind: "pariahTouch", amount: 31 }, ctx(person("Д", { type: "daemon" }))).ok).toBe(false);
    expect(checkTargetWrite({ kind: "pariahTouch", amount: 5 },
      { initiatorOwned: true, initiator: person("Боец"), target: person("Д", { type: "daemon" }) }).ok).toBe(false);
  });

  it("кнопка на Черте Пария зовёт pariahTouch, помощник виден скриптам", () => {
    const entry = PARIAH_TRAIT.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(e => e.kind === "script");
    expect(entry.code).toContain("pariahTouch(actor");
    expect(typeof ELITE_SCRIPT_API.pariahTouch).toBe("function");
  });
});

describe("«Имеющими души»", () => {
  it("бездушные: Пария, Машина, Робот, техника", () => {
    expect(isSoullessActor(person("П", { traits: ["Pariah / Пария"] }))).toBe(true);
    expect(isSoullessActor(person("М", { traits: ["Machine (X) / Машина (X)"] }))).toBe(true);
    expect(isSoullessActor(person("Т", { type: "vehicle" }))).toBe(true);
    expect(isSoullessActor(person("Ч"))).toBe(false);
  });
  it("социальный −30 Парии не действует против бездушной цели", () => {
    const rule = NULL_ZONE_RULES.find(r => r.id === "pariah.self.social");
    expect(rule.when.targetSoulless).toBe(false);
    expect(PREDICATES.targetSoulless(null, { targetActor: person("Т", { type: "vehicle" }) }, false)).toBe(false);
    expect(PREDICATES.targetSoulless(null, { targetActor: person("Ч") }, false)).toBe(true);
    expect(PREDICATES.targetSoulless(null, {}, false)).toBe(true);
  });
});
