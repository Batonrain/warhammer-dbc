// test/rules/ogryn-fit.test.mjs
//
// wdbc-flai: свойство Ogrynized штрафовало обе стороны только на бумаге — у
// свойства не было ни одного читателя, и человек брал огринскую дубину как
// свою, а Огрин обычный болтер — без штрафа и риска сломать.
//
// Устройство скопировано с Легиона (rules/legion-fit.mjs) намеренно, поэтому
// и проверки здесь того же вида: три слагаемых чужой стороны, одно обратной,
// и снятие двух из трёх возможностью Best.Q Откатной Перчатки.

import { describe, it, expect } from "vitest";
import { ogrynAttackPenalty, OGRYN_STEP, OGRYN_RANGED_STEP } from "../../module/rules/ogryn-fit.mjs";

// Человек: Размер 0, S.b 3. Огрин: Размер 1, S.b 10 (Сверхъестественная Сила 6).
const human = { size: 0, sBonus: 3, fitsOgryn: false };
const ogryn = { size: 1, sBonus: 10, fitsOgryn: true };

describe("ogrynAttackPenalty: чужак с огринским оружием", () => {
  it("человек получает все три штрафа", () => {
    const out = ogrynAttackPenalty({ hasOgrynized: true, ...human });
    expect(out.total).toBe(3 * OGRYN_STEP);
    expect(out.parts).toHaveLength(3);
  });

  it("крупный и сильный чужак теряет только штраф за форму рук", () => {
    const out = ogrynAttackPenalty({ hasOgrynized: true, size: 1, sBonus: 10, fitsOgryn: false });
    expect(out.total).toBe(OGRYN_STEP);
    expect(out.parts[0].label).toMatch(/руки/i);
  });

  it("порог Силы у Огринов выше легионного: S.b 7 его не проходит", () => {
    // У Легиона порог 7, здесь 10 — Астартес огринской дубиной тоже не машет
    // как своей, и это разные числа, а не описка.
    const out = ogrynAttackPenalty({ hasOgrynized: true, size: 1, sBonus: 7, fitsOgryn: false });
    expect(out.parts.map(p => p.label)).toContain("Огрины: Бонус Силы меньше 10");
  });

  it("Огрин со своим оружием не штрафуется", () => {
    expect(ogrynAttackPenalty({ hasOgrynized: true, ...ogryn }).total).toBe(0);
  });
});

describe("ogrynAttackPenalty: Огрин с обычным оружием", () => {
  it("рукопашное — −10", () => {
    expect(ogrynAttackPenalty({ hasOgrynized: false, ...ogryn }).total).toBe(OGRYN_STEP);
  });

  it("стрелковое — −20 (Черта «Физиология Громилы»)", () => {
    const out = ogrynAttackPenalty({ hasOgrynized: false, isRanged: true, ...ogryn });
    expect(out.total).toBe(OGRYN_RANGED_STEP);
    expect(out.parts[0].label).toMatch(/стрелков/i);
  });

  it("человека обычное оружие не штрафует вовсе", () => {
    expect(ogrynAttackPenalty({ hasOgrynized: false, ...human })).toEqual({ total: 0, parts: [] });
    expect(ogrynAttackPenalty()).toEqual({ total: 0, parts: [] });
  });
});

describe("ogrynAttackPenalty: Best.Q Откатная Перчатка (wdbc-vsma)", () => {
  // «Люди оперируют оружием Легиона И ОГРИНОВ без штрафов за размер и S.b, но
  // всё ещё с −10 за неудобную форму» — та же возможность, что у Легиона.
  it("человеку остаётся только «неудобная форма» −10", () => {
    const out = ogrynAttackPenalty({ hasOgrynized: true, ...human, ignoresSizeStrength: true });
    expect(out.total).toBe(OGRYN_STEP);
    expect(out.parts).toHaveLength(1);
    expect(out.parts[0].label).toMatch(/руки/i);
  });

  it("на обратную сторону не влияет — там причина другая", () => {
    const out = ogrynAttackPenalty({ hasOgrynized: false, ...ogryn, ignoresSizeStrength: true });
    expect(out.total).toBe(OGRYN_STEP);
  });
});
