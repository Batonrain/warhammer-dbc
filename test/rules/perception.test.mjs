// Восприятие (rules/perception.mjs): освещённость, дым, стены, чувства, слух.
// wdbc-1rno.36, wdbc-1rno.10, Sahara 578-8db0 / 584-13fa / 588-26aa.
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  lightLevelAt, segmentCrossesZones, sensesOf, perceives, hears, effectiveSightAngle, LIGHT, lightPenaltyKey
} from "../../module/rules/perception.mjs";
import { alliesSeeingDocs } from "../../module/combat/living-banner.mjs";
import { atramentarWitnessDocs } from "../../module/combat/terminator-talents.mjs";
import { lightPenaltyImmunityReason } from "../../module/rules/vision-penalty-immunity.mjs";

const grid = { size: 100, distance: 1 };
const doc = (id, x, y, { actor = null, angle = 360, range = 0, rotation = 0, disposition = 1 } = {}) =>
  ({ id, x, y, width: 1, height: 1, rotation, elevation: 0, sight: { range, angle }, actor, disposition });
const item = (type, name, extra = {}) => ({ type, name, system: {}, flags: {}, getFlag: () => undefined, ...extra });
const actorWith = (items = [], system = {}) => ({ items, system: { characteristics: { per: { bonus: 4, total: 40 } }, conditions: {}, ...system } });
const circle = (cx, cy, r) => ({ contains: p => (p.x - cx) ** 2 + (p.y - cy) ** 2 <= r * r });

describe("освещённость точки", () => {
  it("сцена без зрения токенов — освещение не ведётся", () => {
    expect(lightLevelAt({ x: 0, y: 0 }, { tracked: false })).toBeNull();
  });
  it("глобальный свет — яркий; глобальный «не яркий» — слабый", () => {
    expect(lightLevelAt({ x: 0, y: 0 }, { globalLight: true })).toBe(LIGHT.bright);
    expect(lightLevelAt({ x: 0, y: 0 }, { globalLight: true, globalBright: false })).toBe(LIGHT.dim);
  });
  it("без глобального: яркий радиус → Яркий, тусклый → Слабый, вне — Тьма", () => {
    const env = { lights: [{ x: 0, y: 0, bright: 200, dim: 500 }] };
    expect(lightLevelAt({ x: 100, y: 0 }, env)).toBe(LIGHT.bright);
    expect(lightLevelAt({ x: 400, y: 0 }, env)).toBe(LIGHT.dim);
    expect(lightLevelAt({ x: 900, y: 0 }, env)).toBe(LIGHT.dark);
  });
  it("полигон света со стенами (contains) решает, а не только радиус", () => {
    const env = { lights: [{ x: 0, y: 0, bright: 500, dim: 500, contains: p => p.x < 200 }] };
    expect(lightLevelAt({ x: 300, y: 0 }, env)).toBe(LIGHT.dark);
  });
  it("источник тьмы и зона «Тьма» гасят даже глобальный свет", () => {
    expect(lightLevelAt({ x: 0, y: 0 }, { globalLight: true, darkness: [{ x: 0, y: 0, radius: 100 }] })).toBe(LIGHT.dark);
    expect(lightLevelAt({ x: 0, y: 0 }, { globalLight: true, darkZones: [circle(0, 0, 50)] })).toBe(LIGHT.dark);
  });
  it("ключ строки окна атаки", () => {
    expect(lightPenaltyKey(LIGHT.dim)).toBe("dim");
    expect(lightPenaltyKey(LIGHT.dark)).toBe("dark");
    expect(lightPenaltyKey(LIGHT.bright)).toBeNull();
  });
});

describe("дым на линии", () => {
  it("отрезок через облако — да, мимо — нет", () => {
    const smoke = [circle(500, 0, 100)];
    expect(segmentCrossesZones({ x: 0, y: 0 }, { x: 1000, y: 0 }, smoke)).toBe(true);
    expect(segmentCrossesZones({ x: 0, y: 500 }, { x: 1000, y: 500 }, smoke)).toBe(false);
  });
});

describe("чувства актора", () => {
  it("Сонар 30 м, Сверхъестественные Чувства по рейтингу, Ночное Зрение, Взор сквозь Преграды", () => {
    const s = sensesOf(actorWith([
      item("trait", "Sonar Sense / Сонарное Чувство"),
      item("trait", "Unnatural Senses / Сверхъестественные Чувства", { system: { rating: 15 } }),
      item("trait", "Dark Sight / Ночное Зрение"),
      item("trait", "Sight Beyond Barriers / Взор сквозь Преграды (X)", { system: { rating: 40 } })
    ]));
    expect(s).toMatchObject({ sonar: 30, unnatural: 15, darkSight: true, barrier: 40 });
  });
  it("Оглохший и Ослеплённый", () => {
    const s = sensesOf(actorWith([], { conditions: { deafened: true, blinded: true } }));
    expect(s.deaf).toBe(true);
    expect(s.blind).toBe(true);
  });
});

describe("видит ли", () => {
  const herald = doc("h", 0, 0);
  it("без сцены — как раньше: дальность и сектор", () => {
    expect(perceives(doc("a", 500, 0), herald, grid).seen).toBe(true);
    expect(perceives(doc("b", 10000, 0), herald, grid).seen).toBe(false);
  });
  it("стена закрывает обзор; Взор сквозь Преграды — на свою дальность", () => {
    const wall = { sightBlocked: () => true };
    expect(perceives(doc("a", 500, 0), herald, grid, wall).seen).toBe(false);
    const seer = actorWith([item("trait", "Sight Beyond Barriers / Взор сквозь Преграды (X)", { system: { rating: 10 } })]);
    expect(perceives(doc("a", 500, 0, { actor: seer }), herald, grid, wall)).toMatchObject({ seen: true, by: "barrier" });
    expect(perceives(doc("a", 1500, 0, { actor: seer }), herald, grid, wall).seen).toBe(false);
  });
  it("Сонар — сквозь стену и во тьме в 30 м, с любой стороны", () => {
    const bat = actorWith([item("trait", "Sonar Sense / Сонарное Чувство")]);
    const ctx = { sightBlocked: () => true, lightAt: () => LIGHT.dark };
    expect(perceives(doc("a", 2500, 0, { actor: bat, angle: 90 }), herald, grid, ctx)).toMatchObject({ seen: true, by: "sonar" });
    expect(perceives(doc("a", 3500, 0, { actor: bat }), herald, grid, ctx).seen).toBe(false);
  });
  it("тьма у цели: обычный глаз не видит, Ночное Зрение видит", () => {
    const ctx = { lightAt: () => LIGHT.dark };
    expect(perceives(doc("a", 500, 0, { actor: actorWith() }), herald, grid, ctx).why).toBe("тьма");
    const cat = actorWith([item("trait", "Dark Sight / Ночное Зрение")]);
    expect(perceives(doc("a", 500, 0, { actor: cat }), herald, grid, ctx).seen).toBe(true);
  });
  it("дым между — не видит", () => {
    expect(perceives(doc("a", 500, 0, { actor: actorWith() }), herald, grid, { smokeBetween: () => true }).why).toBe("дым");
  });
  it("Ослеплённый не видит, но Сонар его выручает", () => {
    const blind = actorWith([], { conditions: { blinded: true } });
    expect(perceives(doc("a", 500, 0, { actor: blind }), herald, grid).seen).toBe(false);
  });
});

describe("Зрящие Рога (wdbc-1rno.10): обзор назад", () => {
  const horned = actorWith([{
    type: "mutation", name: "Majestic Horns / Величественные Рога", system: { submutation: { label: "9" } },
    getFlag: (ns, k) => (k === "mechanics" ? [{ entries: [
      { kind: "capability", capabilityKey: "mutation.majesticHorns.hornSight", when: { submutations: ["9"] } },
      { kind: "capability", capabilityKey: "mutation.majesticHorns.noVisionAids", when: { submutations: ["9"] } }
    ] }] : undefined)
  }]);
  it("сектор обзора становится круговым", () => {
    expect(effectiveSightAngle(horned, 210)).toBe(360);
    expect(effectiveSightAngle(actorWith(), 210)).toBe(210);
  });
  it("видит того, кто сзади", () => {
    // rotation 0 — смотрит на юг (вниз); цель на севере, сектор 210°.
    const behind = doc("t", 0, -500);
    expect(perceives(doc("o", 0, 0, { actor: actorWith(), angle: 210 }), behind, grid).seen).toBe(false);
    expect(perceives(doc("o", 0, 0, { actor: horned, angle: 210 }), behind, grid).seen).toBe(true);
  });
  it("Охотничий Визор под Рогами не снимает штраф света", () => {
    const visor = { ...item("gear", "Preysense Visor / Охотничий Визор", { system: { equipped: true } }) };
    const a = actorWith([...horned.items, visor]);
    visor.parent = a;
    expect(lightPenaltyImmunityReason(a, [])).toBeNull();
    const b = actorWith([visor]); visor.parent = b;
    expect(lightPenaltyImmunityReason(b, [])).not.toBeNull();
  });
});

describe("слышит ли (Живой Стяг, 584-13fa)", () => {
  const herald = doc("h", 0, 0);
  it("голос в 30 м, глухой не слышит, стена звука глушит", () => {
    expect(hears(doc("a", 2500, 0, { actor: actorWith() }), herald, grid)).toBe(true);
    expect(hears(doc("a", 3500, 0, { actor: actorWith() }), herald, grid)).toBe(false);
    expect(hears(doc("a", 500, 0, { actor: actorWith([], { conditions: { deafened: true } }) }), herald, grid)).toBe(false);
    expect(hears(doc("a", 500, 0, { actor: actorWith() }), herald, grid, { soundBlocked: () => true })).toBe(false);
  });
  it("соратник за стеной зрения, но в пределах голоса — получает Очко", () => {
    const behindWall = doc("a", 1000, 0, { actor: actorWith() });
    const ctx = { sightBlocked: () => true };
    expect(alliesSeeingDocs(herald, [behindWall], grid, ctx).map(d => d.id)).toEqual(["a"]);
    expect(alliesSeeingDocs(herald, [behindWall], grid, { ...ctx, soundBlocked: () => true })).toEqual([]);
  });
});

describe("свидетели Атраментара (588-26aa)", () => {
  const term = doc("t", 0, 0, { disposition: 1 });
  const foe = (id, x) => doc(id, x, 0, { actor: actorWith(), disposition: -1 });
  it("враги, которые видят; союзники — нет; выцеленный — свидетель всегда", () => {
    const docs = [foe("f1", 500), foe("f2", 900), doc("ally", 300, 0, { actor: actorWith(), disposition: 1 })];
    const sees = d => d.id === "f1";
    expect(atramentarWitnessDocs(term, docs, sees).map(d => d.id)).toEqual(["f1"]);
    expect(atramentarWitnessDocs(term, docs, sees, new Set(["f2"])).map(d => d.id)).toEqual(["f1", "f2"]);
  });
});
