// test/rules/library/yigori.test.mjs
//
// Angel Hunters / Охотники на Ангелов (Йигори, сверка главы I): «Раз в Раунд
// Йигори может перебросить любой тест, целью или источником которого является
// Космодесантник». Цель атаки/навыка и источник теста Морали лежат в одном
// поле контекста — ctx.targetActor (rules/morale-test.mjs кладёт туда
// источник Страха), поэтому одно условие покрывает обе стороны книги.

import "../../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocById } from "../../support/pack-doc.mjs";
import { resolveTest } from "../../../module/rules/resolve-test.mjs";
import { PREDICATES } from "../../../module/rules/predicates.mjs";

const AH = packDocById("packs-src/traits", "efM9trbCzi2i0jXA");

function yigori({ withTrait = true } = {}) {
  const items = withTrait ? [{ id: "ah", name: AH.name, type: AH.type, system: AH.system, flags: AH.flags }] : [];
  return { id: "y1", type: "character", system: { race: "yigori" }, items: Object.assign([...items], { contents: items }) };
}
const marine = { id: "m1", type: "character", system: { race: "astartes" }, items: [] };
const traitMarine = { id: "m2", type: "character", system: { race: "human" },
  items: [{ type: "trait", name: "Astartes / Астартес", system: {} }] };
const guard = { id: "g1", type: "character", system: { race: "human" }, items: [] };

const angelRerolls = (actor, ctx) =>
  resolveTest({ actor, ...ctx }).rerolls.filter(r => r.ruleId === "yigori.angelHunters");

describe("предикат targetIsAstartes", () => {
  it("раса или Черта Астартес у цели — да; человек или нет цели — нет", () => {
    expect(PREDICATES.targetIsAstartes(null, { targetActor: marine }, true)).toBe(true);
    expect(PREDICATES.targetIsAstartes(null, { targetActor: traitMarine }, true)).toBe(true);
    expect(PREDICATES.targetIsAstartes(null, { targetActor: guard }, true)).toBe(false);
    expect(PREDICATES.targetIsAstartes(null, {}, true)).toBe(false);
  });
});

describe("Angel Hunters / Охотники на Ангелов", () => {
  it("атака по Космодесантнику — переброс «лучший из 2» самому Йигори", () => {
    const rr = angelRerolls(yigori(), { kind: "attack", targetActor: marine });
    expect(rr).toHaveLength(1);
    expect(rr[0]).toMatchObject({ mode: "keepBest", rolls: 2, who: "self" });
  });

  it("тест Морали, источник которого — Космодесантник (Страх), тоже", () => {
    expect(angelRerolls(yigori(), { kind: "skill", char: "wp", morale: true, targetActor: marine })).toHaveLength(1);
  });

  it("цель — не Космодесантник: переброса нет", () => {
    expect(angelRerolls(yigori(), { kind: "attack", targetActor: guard })).toHaveLength(0);
  });

  it("без Черты — переброса нет (правило не привязано к расе)", () => {
    expect(angelRerolls(yigori({ withTrait: false }), { kind: "attack", targetActor: marine })).toHaveLength(0);
  });
});

// Pheromone Glands / Феромонные Железы: «+10 на любые социальные
// взаимодействия с обычными людьми, если те способны вдыхать их феромоны…
// Соблазнение противоположного пола — +30». Дышит ли собеседник и его пол —
// решает стол, поэтому галочки, а не автоматический модификатор.
describe("Pheromone Glands / Феромонные Железы", () => {
  const PG = packDocById("packs-src/traits", "ALO0louglm3cAqCZ");
  const withGlands = () => {
    const items = [{ id: "pg", name: PG.name, type: PG.type, system: PG.system, flags: PG.flags }];
    return { id: "y2", type: "character", system: {}, items: Object.assign([...items], { contents: items }) };
  };
  const valuesFor = ctx => resolveTest({ actor: withGlands(), ...ctx }).mods.map(m => m.value).sort((a, b) => a - b);

  it("Обаяние: галочки +10 (феромоны) и +20 (Соблазнение) — вместе +30", () => {
    expect(valuesFor({ kind: "skill", skill: "charm", char: "fel" })).toEqual([10, 20]);
  });

  it("другой социальный навык — только +10", () => {
    expect(valuesFor({ kind: "skill", skill: "deceive", char: "fel" })).toEqual([10]);
  });

  it("несоциальный тест — ничего", () => {
    expect(valuesFor({ kind: "skill", skill: "awareness", char: "per" })).toEqual([]);
  });

  it("галочки не автоматические: их ставит игрок", () => {
    const { autoMods } = resolveTest({ actor: withGlands(), kind: "skill", skill: "charm", char: "fel" });
    expect(autoMods.filter(m => /Феромон/.test(m.label))).toEqual([]);
  });
});
