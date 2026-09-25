// test/rules/horde-single-target.test.mjs
//
// «Быстрые и Мёртвые» (Человек) и Физиология Отеший (Серый Человек): атаки
// Орды и «Троек» Концентрации огня — как атаки одиночного персонажа, пока
// Размер < 2 (module/rules/horde-single-target.mjs). Фикстура Черты берётся
// из настоящего JSON в packs-src — иначе зелёный тест не доказал бы, что
// флаг действительно едет с Чертой.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { evadesHordeAsSingle, hordeHitEvasionBlock, sizeTotalOf }
  from "../../module/rules/horde-single-target.mjs";

const QATD = packDocById("packs-src/traits", "Iqc2Fn8gX8USBY3D");

function actor({ sizeTotal = 0, withTrait = true } = {}) {
  const items = withTrait ? [{ id: "t1", name: QATD.name, type: QATD.type, system: QATD.system, flags: QATD.flags }] : [];
  return { id: "a1", type: "character", system: { sizeTotal },
           items: Object.assign([...items], { contents: items }) };
}

describe("Быстрые и Мёртвые — атаки Орды как одиночные", () => {
  it("Черта из пака несёт флаг: Размер 0 — действует", () => {
    expect(evadesHordeAsSingle(actor())).toBe(true);
  });

  it("без Черты — не действует (контроль)", () => {
    expect(evadesHordeAsSingle(actor({ withTrait: false }))).toBe(false);
  });

  it("Размер 2+ — Трейт теряет эффект", () => {
    expect(evadesHordeAsSingle(actor({ sizeTotal: 2 }))).toBe(false);
    expect(evadesHordeAsSingle(actor({ sizeTotal: 1 }))).toBe(true);
  });

  it("нет актора (цель не выбрана) — не действует", () => {
    expect(evadesHordeAsSingle(null)).toBe(false);
  });

  it("попадание Орды: с Чертой Избегать можно, без — отказ с причиной", () => {
    expect(hordeHitEvasionBlock(actor(), true)).toBe("");
    expect(hordeHitEvasionBlock(actor({ withTrait: false }), true)).toMatch(/нельзя Избегать/);
    expect(hordeHitEvasionBlock(actor({ sizeTotal: 3 }), true)).toMatch(/нельзя Избегать/);
  });

  it("промах Орды Избегать может любой", () => {
    expect(hordeHitEvasionBlock(actor({ withTrait: false }), false)).toBe("");
  });

  it("sizeTotalOf без sizeTotal складывает базу и модификаторы", () => {
    expect(sizeTotalOf({ system: { size: 1, sizeMod: 1, sizeModNoSpd: 0 } })).toBe(2);
  });
});
