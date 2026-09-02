// test/rules/plague-shepherd.test.mjs
//
// wdbc-w8ws: Мутация «Plague Shepherd / Чумной Пастырь» — арифметика гранта
// аблативных Ран подчинённым от Команды/Брифинга, не складывающегося с
// прошлой командой. Резолв командира/подчинённых и запись во флаг —
// module/sheets/squad-sheet.mjs (_applyPlagueShepherd), не здесь.

import { describe, it, expect } from "vitest";
import { isPlagueShepherdItem, hasPlagueShepherd, plagueShepherdGrant, plagueShepherdShrinkToFit,
         isInfected, plagueShepherdFreeCommandActive }
  from "../../module/rules/plague-shepherd.mjs";

describe("isPlagueShepherdItem / hasPlagueShepherd", () => {
  it("узнаёт Мутацию по книжному двуязычному имени", () => {
    expect(isPlagueShepherdItem({ type: "mutation", name: "Plague Shepherd / Чумной Пастырь" })).toBe(true);
  });
  it("hasPlagueShepherd сканирует items актора", () => {
    const actor = { items: [{ type: "mutation", name: "Plague Shepherd / Чумной Пастырь" }] };
    expect(hasPlagueShepherd(actor)).toBe(true);
    expect(hasPlagueShepherd({ items: [] })).toBe(false);
    expect(hasPlagueShepherd(null)).toBe(false);
  });
});

describe("plagueShepherdGrant: не складывается с прошлой командой", () => {
  it("с нуля — просто ставит Успехи, ablativeMax двигается вместе", () => {
    const system = { wounds: { ablative: 0, ablativeMax: 0 } };
    expect(plagueShepherdGrant(system, 0, 5)).toEqual({ newAblative: 5, newAblativeMax: 5, contribution: 5 });
  });

  it("новая команда ЗАМЕНЯЕТ вклад прошлой, не складывая", () => {
    const system = { wounds: { ablative: 5, ablativeMax: 5 } };
    expect(plagueShepherdGrant(system, 5, 3)).toEqual({ newAblative: 3, newAblativeMax: 3, contribution: 3 });
  });

  it("посторонний аблатив (другой источник) остаётся нетронутым", () => {
    // Пул 8: 5 от Пастыря (прошлая команда) + 3 от Absurdly Fat постороннего.
    const system = { wounds: { ablative: 8, ablativeMax: 8 } };
    expect(plagueShepherdGrant(system, 5, 2)).toEqual({ newAblative: 5, newAblativeMax: 5, contribution: 2 });
  });

  it("нулевые Успехи — просто снимают прошлый вклад источника", () => {
    const system = { wounds: { ablative: 5, ablativeMax: 5 } };
    expect(plagueShepherdGrant(system, 5, 0)).toEqual({ newAblative: 0, newAblativeMax: 0, contribution: 0 });
  });
});

describe("plagueShepherdShrinkToFit: доля не больше, чем реально осталось (поглощение урона)", () => {
  it("пул просел ниже доли — доля и ablativeMax сжимаются", () => {
    expect(plagueShepherdShrinkToFit({ wounds: { ablative: 2, ablativeMax: 5 } }, 5)).toEqual({ ablativeMax: 2, contribution: 2 });
  });
  it("пул не просел — сжимать нечего", () => {
    expect(plagueShepherdShrinkToFit({ wounds: { ablative: 5, ablativeMax: 5 } }, 5)).toBeNull();
  });
});

describe("isInfected", () => {
  it("есть embedded Item type:disease — заражён", () => {
    expect(isInfected({ items: [{ type: "disease" }] })).toBe(true);
  });
  it("нет — не заражён", () => {
    expect(isInfected({ items: [{ type: "talent" }] })).toBe(false);
    expect(isInfected({ items: [] })).toBe(false);
    expect(isInfected(null)).toBe(false);
  });
});

describe("plagueShepherdFreeCommandActive: Короткая свободным, Детальная полудействием", () => {
  const shepherd = (infected = true) => ({
    items: [
      { type: "mutation", name: "Plague Shepherd / Чумной Пастырь" },
      ...(infected ? [{ type: "disease" }] : [])
    ]
  });
  const member = infected => ({ items: infected ? [{ type: "disease" }] : [] });

  it("командир и все подчинённые заражены — активно", () => {
    expect(plagueShepherdFreeCommandActive(shepherd(true), [member(true), member(true)])).toBe(true);
  });

  it("хотя бы один подчинённый не заражён — неактивно", () => {
    expect(plagueShepherdFreeCommandActive(shepherd(true), [member(true), member(false)])).toBe(false);
  });

  it("сам командир не заражён — неактивно, даже если все подчинённые заражены", () => {
    expect(plagueShepherdFreeCommandActive(shepherd(false), [member(true)])).toBe(false);
  });

  it("нет Мутации у командира — неактивно", () => {
    expect(plagueShepherdFreeCommandActive({ items: [{ type: "disease" }] }, [member(true)])).toBe(false);
  });

  it("нет подчинённых вовсе — неактивно (нечего проверять)", () => {
    expect(plagueShepherdFreeCommandActive(shepherd(true), [])).toBe(false);
  });
});
