// test/rules/flayed.test.mjs
//
// wdbc-w8ws: Мутация «Flayed / Освежёванный» — динамическая часть (содранная
// кожа даёт 3+Размер донора аблативных Ран, потолок 3×Cor.b). Статика
// (−5 максимум Ран) — обычная запись Конструктора kind:"wounds", не здесь.

import { describe, it, expect } from "vitest";
import { isFlayedItem, flayedGrant, flayedShrinkToFit, flayedVisualNote } from "../../module/rules/flayed.mjs";

describe("isFlayedItem", () => {
  it("узнаёт Мутацию по книжному двуязычному имени", () => {
    expect(isFlayedItem({ type: "mutation", name: "Flayed / Освежёванный" })).toBe(true);
  });
  it("не путает с другой Мутацией", () => {
    expect(isFlayedItem({ type: "mutation", name: "Cancerous Healing / Раковое Исцеление" })).toBe(false);
  });
});

describe("flayedGrant: 3+Размер донора, потолок 3×Cor.b, своя доля копится отдельно", () => {
  it("копится с нуля, ablativeMax двигается вместе", () => {
    const wearer = { corruptionBonus: 4, wounds: { ablative: 0, ablativeMax: 0 } };
    const donor = { system: { size: 0 } };
    expect(flayedGrant(wearer, 0, donor)).toEqual({
      newAblative: 3, newAblativeMax: 3, contribution: 3, granted: 3, cap: 12, add: 3, donorSize: 0
    });
  });

  it("донор с Размером увеличивает прибавку", () => {
    const wearer = { corruptionBonus: 4, wounds: { ablative: 0, ablativeMax: 0 } };
    const donor = { system: { size: 2 } };
    expect(flayedGrant(wearer, 0, donor)).toMatchObject({ add: 5, newAblative: 5, contribution: 5, granted: 5 });
  });

  it("складывается с уже имеющейся своей кожей, а не заменяет её", () => {
    const wearer = { corruptionBonus: 4, wounds: { ablative: 5, ablativeMax: 5 } };
    const donor = { system: { size: 0 } };
    expect(flayedGrant(wearer, 5, donor)).toMatchObject({ newAblative: 8, contribution: 8, granted: 3 });
  });

  it("не трогает посторонний аблатив на том же акторе", () => {
    // Пул 9: 5 своей кожи (прошлый раз) + 4 постороннего.
    const wearer = { corruptionBonus: 4, wounds: { ablative: 9, ablativeMax: 9 } };
    const donor = { system: { size: 0 } };
    expect(flayedGrant(wearer, 5, donor)).toMatchObject({ newAblative: 12, contribution: 8 }); // 4 чужого + 8 своего
  });

  it("срезается потолком 3×Cor.b", () => {
    const wearer = { corruptionBonus: 2, wounds: { ablative: 5, ablativeMax: 5 } }; // cap 6
    const donor = { system: { size: 3 } }; // add 6
    expect(flayedGrant(wearer, 5, donor)).toMatchObject({ cap: 6, newAblative: 6, contribution: 6, granted: 1 });
  });

  it("уже на потолке — granted 0", () => {
    const wearer = { corruptionBonus: 2, wounds: { ablative: 6, ablativeMax: 6 } };
    const donor = { system: { size: 0 } };
    expect(flayedGrant(wearer, 6, donor)).toMatchObject({ newAblative: 6, granted: 0 });
  });
});

describe("flayedShrinkToFit: доля не больше, чем реально осталось (поглощение урона)", () => {
  it("пул просел ниже доли — доля и ablativeMax сжимаются", () => {
    const wearer = { wounds: { ablative: 4, ablativeMax: 10 } };
    expect(flayedShrinkToFit(wearer, 8)).toEqual({ ablativeMax: 6, contribution: 4 });
  });
  it("пул не просел — сжимать нечего", () => {
    expect(flayedShrinkToFit({ wounds: { ablative: 8, ablativeMax: 10 } }, 8)).toBeNull();
  });
});

describe("flayedVisualNote: флейвор-пороги", () => {
  it("6+ — складки", () => {
    expect(flayedVisualNote(6)).toMatch(/складк/);
    expect(flayedVisualNote(9)).toMatch(/складк/);
  });
  it("<5 — истончается", () => {
    expect(flayedVisualNote(4)).toMatch(/истонча/);
    expect(flayedVisualNote(0)).toMatch(/истонча/);
  });
  it("5 ровно — без особой пометки", () => {
    expect(flayedVisualNote(5)).toBe("");
  });
});
