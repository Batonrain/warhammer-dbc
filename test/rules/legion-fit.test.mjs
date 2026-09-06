// test/rules/legion-fit.test.mjs
//
// Свойство Legion штрафует обе стороны: чужак не сладит с легионным хватом, а
// Астартес не пролезет пальцем в обычную спусковую скобу. До этого свойство
// было памяткой (auto: attackMod 0) и на порог не влияло вовсе.

import { describe, it, expect } from "vitest";
import { legionAttackPenalty, LEGION_STEP } from "../../module/rules/legion-fit.mjs";

const human   = { size: 0, sBonus: 3, fitsLegion: false };
const astartes = { size: 1, sBonus: 8, fitsLegion: true };

describe("legionAttackPenalty", () => {
  it("человек с легионным оружием получает все три штрафа", () => {
    const out = legionAttackPenalty({ hasLegion: true, ...human });
    expect(out.total).toBe(3 * LEGION_STEP);
    expect(out.parts).toHaveLength(3);
  });

  it("крупный и сильный чужак теряет только штраф за хват", () => {
    const out = legionAttackPenalty({ hasLegion: true, size: 1, sBonus: 7, fitsLegion: false });
    expect(out.total).toBe(LEGION_STEP);
    expect(out.parts[0].label).toMatch(/руки/i);
  });

  it("Астартес со своим оружием не штрафуется", () => {
    expect(legionAttackPenalty({ hasLegion: true, ...astartes }).total).toBe(0);
  });

  it("Астартес с обычным оружием получает −10", () => {
    expect(legionAttackPenalty({ hasLegion: false, ...astartes }).total).toBe(LEGION_STEP);
  });

  it("гранаты Астартес кидает без штрафа", () => {
    expect(legionAttackPenalty({ hasLegion: false, isGrenade: true, ...astartes }).total).toBe(0);
  });

  it("обычное оружие у обычного персонажа штрафа не даёт", () => {
    expect(legionAttackPenalty({ hasLegion: false, ...human })).toEqual({ total: 0, parts: [] });
    expect(legionAttackPenalty()).toEqual({ total: 0, parts: [] });
  });
});

// ── Best.Q Откатная Перчатка (wdbc-vsma) ───────────────────────────────────
// «Люди оперируют оружием Легиона и Огринов без штрафов за недостаточный
// размер и S.b, но всё ещё с −10 за неудобную форму» — снимаются ровно два
// слагаемых из трёх, третье остаётся.
describe("legionAttackPenalty: снятие штрафов за Размер и Силу (Best.Q Перчатка)", () => {
  it("человеку остаётся только «неудобная форма» −10", () => {
    const out = legionAttackPenalty({ hasLegion: true, ...human, ignoresSizeStrength: true });
    expect(out.total).toBe(LEGION_STEP);
    expect(out.parts).toHaveLength(1);
    expect(out.parts[0].label).toMatch(/руки/i);
  });

  it("без возможности тот же человек получает все три", () => {
    expect(legionAttackPenalty({ hasLegion: true, ...human }).total).toBe(3 * LEGION_STEP);
  });

  it("на штраф Астартес за НЕлегионное оружие не влияет — там другая причина", () => {
    const out = legionAttackPenalty({ hasLegion: false, ...astartes, ignoresSizeStrength: true });
    expect(out.total).toBe(LEGION_STEP);
  });
});
