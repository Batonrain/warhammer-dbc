// test/rules/wound-in-reality.test.mjs
//
// Пачка I2 (Псайкана, Sahara 3-28, решение владельца 26.10.2026): Рана в Реальности —
// галочка «бесплатная» на поддерживаемой силе (до Cor.b, пока на платное поддержание уходит
// хотя бы 3 PR), бесплатные силы не снижают тPR, а вокруг псайкера на Cor.b×2 м ложится
// автоматическая аура: −5 Пси-чутьё, +10 Феномены, +10 Варп-Нестабильность за каждую
// бесплатную силу, Истончение Завесы +1 за каждые три. Талант берётся из настоящего пака.

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  WOUND_FREE_FLAG, WOUND_AURA_NAME, hasWoundInReality, woundFreeLimit, woundSustainSplit,
  woundFreeCount, woundFreeToggleGate, woundAuraTotals, woundAuraRules, woundAuraPhenMod,
  woundAuraVeil, isWoundAuraMarker
} from "../../module/rules/wound-in-reality.mjs";
import { mechFormulaTotal, mechRollData } from "../../module/rules/mech-formula.mjs";

const DIR = "packs-src/talents/Псайкана";
const woundDoc = () => packDocById(DIR, "HlOOH4XLJ1Oilfjn");

const talent = () => { const d = woundDoc(); return { type: "talent", name: d.name, system: { ...d.system }, flags: {} }; };
const power = (name, { sustained = true, cost = 1, free = false } = {}) => ({
  type: "psychicPower", name, id: name,
  system: { isSustained: sustained, sustainCost: cost },
  flags: { "warhammer-dbc": free ? { [WOUND_FREE_FLAG]: true } : {} },
  getFlag(s, k) { return this.flags[s]?.[k]; }
});
const actor = (items, cor = 5) => ({ type: "character", items, system: { corruptionBonus: cor, psyker: { rating: 9 } } });

describe("Рана в Реальности — Талант в настоящем паке", () => {
  it("код опознаёт его по имени из пака", () => {
    expect(hasWoundInReality(actor([talent()]))).toBe(true);
    expect(hasWoundInReality(actor([]))).toBe(false);
  });
  it("предмет другого типа с тем же именем не считается", () => {
    expect(hasWoundInReality(actor([{ ...talent(), type: "gear" }]))).toBe(false);
  });
  it("предел бесплатных сил — Cor.b", () => {
    expect(woundFreeLimit(actor([talent()], 4))).toBe(4);
    expect(woundFreeLimit(actor([], 4))).toBe(0);
  });
});

describe("поддержание: бесплатные силы не снижают тPR", () => {
  const A = (powers, cor = 5) => actor([talent(), ...powers], cor);

  it("платных 3 PR, одна бесплатная — платит только платное", () => {
    const a = A([power("A"), power("B"), power("C"), power("D", { free: true })]);
    const s = woundSustainSplit(a);
    expect(s.paid).toBe(3);
    expect(s.free).toBe(1);
    expect(s.gateOk).toBe(true);
  });
  it("платных меньше 3 — пометка не работает, всё платное (книга: «ограничиваясь изначальными тремя»)", () => {
    const a = A([power("A"), power("B"), power("D", { free: true })]);
    const s = woundSustainSplit(a);
    expect(s.gateOk).toBe(false);
    expect(s.paid).toBe(3);
    expect(s.free).toBe(0);
  });
  it("предел Cor.b: сверх предела силы платные", () => {
    const a = A([power("A", { cost: 3 }), power("F1", { free: true }), power("F2", { free: true }), power("F3", { free: true })], 2);
    const s = woundSustainSplit(a);
    expect(s.free).toBe(2);
    expect(s.paid).toBe(4);
  });
  it("пометки сверх Cor.b платны и входят в порог 3 PR (Порча упала, пометки остались)", () => {
    const a = A([power("A", { cost: 2 }), power("F1", { free: true }), power("F2", { free: true })], 1);
    const s = woundSustainSplit(a);
    expect(s.gateOk).toBe(true);
    expect(s.free).toBe(1);
    expect(s.paid).toBe(3);
  });
  it("цена поддержания силы учитывается (sustainCost)", () => {
    const a = A([power("A", { cost: 3 }), power("F", { cost: 2, free: true })]);
    const s = woundSustainSplit(a);
    expect(s.free).toBe(2);
    expect(s.paid).toBe(3);
  });
  it("неподдерживаемая сила с пометкой ничего не весит", () => {
    const a = A([power("A", { cost: 3 }), power("F", { sustained: false, free: true })]);
    expect(woundSustainSplit(a).free).toBe(0);
  });
  it("без Таланта пометка игнорируется, платят все", () => {
    const a = actor([power("A", { cost: 3 }), power("F", { free: true })]);
    const s = woundSustainSplit(a);
    expect(s.free).toBe(0);
    expect(s.paid).toBe(4);
  });
  it("woundFreeCount — число действующих бесплатных сил", () => {
    const a = A([power("A", { cost: 3 }), power("F1", { free: true }), power("F2", { free: true })]);
    expect(woundFreeCount(a)).toBe(2);
    expect(woundFreeCount(actor([]))).toBe(0);
  });
});

describe("галочка «бесплатная»: когда можно поставить", () => {
  const A = (powers, cor = 5) => actor([talent(), ...powers], cor);

  it("можно: платных 3, предел не выбран", () => {
    const p = power("D");
    expect(woundFreeToggleGate(A([power("A", { cost: 3 }), p]), p).ok).toBe(true);
  });
  it("нельзя без Таланта", () => {
    const p = power("D");
    const g = woundFreeToggleGate(actor([power("A", { cost: 3 }), p]), p);
    expect(g.ok).toBe(false);
    expect(g.code).toBe("no-talent");
  });
  it("нельзя, пока на платное уходит меньше 3 PR (сама сила в счёт не идёт)", () => {
    const p = power("D");
    const g = woundFreeToggleGate(A([power("A", { cost: 2 }), p]), p);
    expect(g.ok).toBe(false);
    expect(g.code).toBe("paid");
  });
  it("нельзя сверх Cor.b", () => {
    const p = power("D");
    const g = woundFreeToggleGate(A([power("A", { cost: 3 }), power("F", { free: true }), p], 1), p);
    expect(g.ok).toBe(false);
    expect(g.code).toBe("limit");
  });
  it("в окне манифестации сила ещё не поддерживается — assumeSustained разрешает ставить", () => {
    const p = power("D", { sustained: false });
    expect(woundFreeToggleGate(A([power("A", { cost: 3 }), p]), p).ok).toBe(false);
    expect(woundFreeToggleGate(A([power("A", { cost: 3 }), p]), p, { assumeSustained: true }).ok).toBe(true);
  });
  it("снять пометку можно всегда", () => {
    const p = power("D", { free: true });
    expect(woundFreeToggleGate(actor([], 0), p, { off: true }).ok).toBe(true);
  });
});

describe("аура: числа за каждую бесплатную силу", () => {
  it("−5 Пси-чутьё, +10 Феномены, +10 Нестабильность; Завеса +1 за каждые 3", () => {
    expect(woundAuraTotals(1)).toEqual({ n: 1, psyniscience: -5, phenomena: 10, instability: 10, veil: 0 });
    expect(woundAuraTotals(3)).toEqual({ n: 3, psyniscience: -15, phenomena: 30, instability: 30, veil: 1 });
    expect(woundAuraTotals(7)).toEqual({ n: 7, psyniscience: -35, phenomena: 70, instability: 70, veil: 2 });
    expect(woundAuraTotals(0).phenomena).toBe(0);
  });
});

describe("аура: метка на токене и правила бросков", () => {
  const source = n => ({ parent: actor([talent(), ...Array.from({ length: n }, (_, i) => power(`F${i}`, { free: true })), power("P", { cost: 3 })], 9) });
  const markerOf = (srcUuid, name = WOUND_AURA_NAME) => ({ type: "trait", name,
    flags: { "warhammer-dbc": { auraSource: srcUuid } },
    getFlag(s, k) { return this.flags[s]?.[k]; } });
  // Резолвер uuid источника → Талант; в игре — fromUuidSync.
  const resolver = map => uuid => map[uuid] ?? null;

  it("метка опознаётся по имени служебной Черты", () => {
    expect(isWoundAuraMarker(markerOf("x"))).toBe(true);
    expect(isWoundAuraMarker({ type: "trait", name: "Aura of Humility / Аура Смирения" })).toBe(false);
  });
  it("Пси-чутьё −5×N, Нестабильность +10×N — правилами для конвейера бросков", () => {
    const src = source(3);
    const t = { parent: src.parent };
    const a = actor([markerOf("U1")]);
    const rules = woundAuraRules(a, resolver({ U1: t }));
    const fx = rules.flatMap(r => r.effects);
    const psy = fx.find(e => e.target === "skill:psyniscience");
    const inst = fx.find(e => e.target === "instability");
    expect(psy.value).toBe(-15);
    expect(inst.value).toBe(30);
    expect(fx.every(e => e.auto === true && e.kind === "rollBonus")).toBe(true);
  });
  it("Феномены +10×N — число для броска Феномена манифестации", () => {
    const a = actor([markerOf("U1")]);
    expect(woundAuraPhenMod(a, resolver({ U1: { parent: source(2).parent } }))).toBe(20);
  });
  it("две ауры от двух псайкеров складываются; Завеса — по каждой отдельно", () => {
    const a = actor([markerOf("U1"), markerOf("U2")]);
    const r = resolver({ U1: { parent: source(3).parent }, U2: { parent: source(3).parent } });
    expect(woundAuraPhenMod(a, r)).toBe(60);
    expect(woundAuraVeil(a, r)).toBe(2);
  });
  it("источник не нашёлся — метка считается за одну силу (аура без источника не живёт, но не обнуляется молча)", () => {
    const a = actor([markerOf("GONE")]);
    expect(woundAuraPhenMod(a, resolver({}))).toBe(10);
  });
  it("вне ауры правил нет", () => {
    expect(woundAuraRules(actor([]), resolver({}))).toEqual([]);
    expect(woundAuraPhenMod(actor([]), resolver({}))).toBe(0);
  });
});

describe("радиус ауры — формула Конструктора с ключом «wound»", () => {
  const FORMULA = "ceil(wound/(wound+1))*cor*2";
  it("нет бесплатных сил — радиус 0 (ауры нет), есть — Cor.b×2", () => {
    expect(mechFormulaTotal(FORMULA, { wound: 0, cor: 5 })).toBe(0);
    expect(mechFormulaTotal(FORMULA, { wound: 1, cor: 5 })).toBe(10);
    expect(mechFormulaTotal(FORMULA, { wound: 4, cor: 5 })).toBe(10);
  });
  it("mechRollData считает «wound» по предметам актора", () => {
    const a = { ...actor([talent(), power("A", { cost: 3 }), power("F", { free: true })], 5), system: { corruptionBonus: 5, characteristics: {} } };
    expect(mechRollData(a).wound).toBe(1);
  });
});

describe("аура в общем конвейере бросков (resolveTest + настоящий реестр источников)", () => {
  // Метка с настоящим именем из пака; источник резолвится глобальным fromUuidSync, как в игре.
  const markerDoc = () => packDocById("packs-src/traits", "WoundRealityAura");

  async function withSource(n, fn) {
    await import("../support/foundry-stub.mjs");
    const { resolveTest } = await import("../../module/rules/resolve-test.mjs");
    const src = { parent: actor([talent(), power("P", { cost: 3 }), ...Array.from({ length: n }, (_, i) => power(`F${i}`, { free: true }))], 9) };
    const prev = globalThis.fromUuidSync;
    globalThis.fromUuidSync = uuid => (uuid === "Actor.psyker.Item.wound" ? src : null);
    try { return fn(resolveTest); } finally { globalThis.fromUuidSync = prev; }
  }
  const marked = () => {
    const d = markerDoc();
    return { type: "trait", name: d.name, system: { ...d.system },
      flags: { "warhammer-dbc": { auraSource: "Actor.psyker.Item.wound" } },
      getFlag(s, k) { return this.flags[s]?.[k]; } };
  };
  const target = () => ({ type: "character", items: [marked()], system: { characteristics: {}, skills: {} }, getFlag: () => undefined });

  it("метка из настоящего пака опознаётся кодом", () => {
    expect(isWoundAuraMarker(marked())).toBe(true);
  });
  it("тест Пси-чутья: −5 за каждую бесплатную силу", async () => {
    const r = await withSource(2, rt => rt({ actor: target(), kind: "skill", skill: "psyniscience" }));
    const m = [...r.autoMods, ...r.mods].find(x => /Рана в Реальности/.test(x.label));
    expect(m?.value).toBe(-10);
  });
  it("тест Нестабильности: +10 за каждую бесплатную силу", async () => {
    const r = await withSource(3, rt => rt({ actor: target(), kind: "instability" }));
    const m = [...r.autoMods, ...r.mods].find(x => /Рана в Реальности/.test(x.label));
    expect(m?.value).toBe(30);
  });
  it("чужие тесты (Атлетика) ауру не получают", async () => {
    const r = await withSource(3, rt => rt({ actor: target(), kind: "skill", skill: "athletics" }));
    expect([...r.autoMods, ...r.mods].some(x => /Рана в Реальности/.test(x.label))).toBe(false);
  });
});

describe("служебная метка и запись Конструктора в паке", () => {
  const talentDoc = () => woundDoc();
  const entries = () => talentDoc().flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

  it("на Таланте есть запись-возможность и запись ауры", () => {
    expect(entries().some(e => e.kind === "capability" && e.capabilityKey === "psyker.core.woundInReality")).toBe(true);
    expect(entries().some(e => e.kind === "aura")).toBe(true);
  });
  it("аура: на всех, включая себя; радиус — формула Cor.b×2 с ключом wound; цель — метка из пака", () => {
    const aura = entries().find(e => e.kind === "aura");
    expect(aura.auraAffects).toBe("all");
    expect(aura.auraIncludesSelf).toBe(true);
    expect(mechFormulaTotal(aura.auraRadius, { wound: 0, cor: 5 })).toBe(0);
    expect(mechFormulaTotal(aura.auraRadius, { wound: 2, cor: 5 })).toBe(10);
    const markerId = aura.sourceUuid.split(".").pop();
    expect(packDocById("packs-src/traits", markerId).name).toBe(WOUND_AURA_NAME);
  });
  it("id метки — ровно 16 символов (иначе мир не загрузится)", () => {
    const d = packDocById("packs-src/traits", "WoundRealityAura");
    expect(d._id).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(d._key).toBe(`!items!${d._id}`);
  });
});
