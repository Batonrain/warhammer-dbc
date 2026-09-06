// test/rules/hyper-growth.test.mjs
//
// wdbc-utaw: боеприпас «Гиперрост» — после урона от яда цель получает
// столько же аблативных Ран (общий пул актора, не привязка к зоне — см.
// докстринг module/rules/hyper-growth.mjs). Единственный «аблатив» из
// wdbc-173l, где получатель — цель атаки, не владелец боеприпаса.

import { describe, it, expect } from "vitest";
import { isHyperGrowthAmmoName, hyperGrowthGrant, hyperGrowthShrinkToFit } from "../../module/rules/hyper-growth.mjs";

describe("isHyperGrowthAmmoName: опознание боеприпаса по имени", () => {
  it("узнаёт по книжному имени", () => {
    expect(isHyperGrowthAmmoName("Гиперрост")).toBe(true);
  });
  it("не путает с другим Toxic-боеприпасом — мутационная проверка привязки к КОНКРЕТНОМУ патрону", () => {
    expect(isHyperGrowthAmmoName("Дум-дум")).toBe(false);
    expect(isHyperGrowthAmmoName("Токсичные Дротики")).toBe(false);
  });
  it("пусто/не задано — нет", () => {
    expect(isHyperGrowthAmmoName("")).toBe(false);
    expect(isHyperGrowthAmmoName(undefined)).toBe(false);
  });
});

describe("hyperGrowthGrant: цель получает столько же аблатива, сколько урона от яда", () => {
  it("первый тик с нуля", () => {
    const target = { wounds: { ablative: 0, ablativeMax: 0 } };
    expect(hyperGrowthGrant(target, 0, 6)).toEqual({ ablative: 6, ablativeMax: 6, contribution: 6, granted: 6 });
  });

  it("второй тик складывается с прошлым, не заменяет", () => {
    const target = { wounds: { ablative: 6, ablativeMax: 6 } };
    expect(hyperGrowthGrant(target, 6, 3)).toEqual({ ablative: 9, ablativeMax: 9, contribution: 9, granted: 3 });
  });

  it("не трогает посторонний аблатив цели (другой источник на том же акторе)", () => {
    // Пул 10: 6 своего (прошлый тик Гиперроста) + 4 постороннего.
    const target = { wounds: { ablative: 10, ablativeMax: 10 } };
    expect(hyperGrowthGrant(target, 6, 3)).toMatchObject({ ablative: 13, contribution: 9 }); // 4 чужого + 9 своего
  });

  it("dmg ≤ 0 — null, ничего не меняет", () => {
    const target = { wounds: { ablative: 0, ablativeMax: 0 } };
    expect(hyperGrowthGrant(target, 0, 0)).toBeNull();
    expect(hyperGrowthGrant(target, 0, -3)).toBeNull();
  });

  it("нет потолка — книга его не задаёт, копится сколько угодно", () => {
    const target = { wounds: { ablative: 50, ablativeMax: 50 } };
    expect(hyperGrowthGrant(target, 50, 20)).toMatchObject({ ablative: 70, contribution: 70, granted: 20 });
  });
});

describe("hyperGrowthShrinkToFit: доля не больше, чем реально осталось (поглощение боевого урона)", () => {
  it("пул просел ниже доли — доля и ablativeMax сжимаются", () => {
    const target = { wounds: { ablative: 4, ablativeMax: 10 } };
    expect(hyperGrowthShrinkToFit(target, 8)).toEqual({ ablativeMax: 6, contribution: 4 });
  });
  it("пул не просел — сжимать нечего", () => {
    expect(hyperGrowthShrinkToFit({ wounds: { ablative: 8, ablativeMax: 10 } }, 8)).toBeNull();
  });
  it("своего вклада не было — null", () => {
    expect(hyperGrowthShrinkToFit({ wounds: { ablative: 8, ablativeMax: 10 } }, 0)).toBeNull();
  });
});
