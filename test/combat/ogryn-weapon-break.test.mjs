// test/combat/ogryn-weapon-break.test.mjs
//
// wdbc-flai, вторая половина правила Огринов: «Огрин при рукопашной атаке
// оружием без свойства Ogrynized бросает 1d10: на 1-3 оно ломается до починки
// за ½ смены». Штрафы к тесту живут отдельно (rules/ogryn-fit.mjs) — это
// бросок ПОСЛЕ атаки со своим последствием на предмете.

import { describe, it, expect } from "vitest";
import { ogrynBreaksWeapon, ogrynBreakApplies, ogrynBreakNote, OGRYN_BREAK_FACES }
  from "../../module/combat/ogryn-weapon-break.mjs";

const ogrynActor = () => ({ system: { race: "ogryn", size: 1, characteristics: {} }, items: [] });
const humanActor = () => ({ system: { race: "human", size: 0, characteristics: {} }, items: [] });

describe("ogrynBreaksWeapon: на каких гранях ломается", () => {
  const melee = { fitsOgryn: true, hasOgrynized: false, isMelee: true };

  // Грани перечислены ЧИСЛАМИ, а не через OGRYN_BREAK_FACES: тест, который
  // берёт список из того же модуля, проверяет сам себя — сужение диапазона до
  // 1-2 он бы пропустил (поймано проверкой мутациями).
  it("1, 2 и 3 — ломается", () => {
    for (const d10 of [1, 2, 3]) expect(ogrynBreaksWeapon({ ...melee, d10 })).toBe(true);
  });

  it("граница ровно между 3 и 4", () => {
    expect(ogrynBreaksWeapon({ ...melee, d10: 3 })).toBe(true);
    expect(ogrynBreaksWeapon({ ...melee, d10: 4 })).toBe(false);
    expect(OGRYN_BREAK_FACES).toEqual([1, 2, 3]);
  });

  it("4 и выше — выдерживает", () => {
    for (const d10 of [4, 5, 7, 10]) expect(ogrynBreaksWeapon({ ...melee, d10 })).toBe(false);
  });

  it("огринское оружие не ломается вовсе — оно под него и сделано", () => {
    expect(ogrynBreaksWeapon({ ...melee, hasOgrynized: true, d10: 1 })).toBe(false);
  });

  it("стрелковая атака не ломает: у неё своя цена, −20 к тесту", () => {
    expect(ogrynBreaksWeapon({ ...melee, isMelee: false, d10: 1 })).toBe(false);
  });

  it("не-Огрин человеческим оружием ничего не ломает", () => {
    expect(ogrynBreaksWeapon({ ...melee, fitsOgryn: false, d10: 1 })).toBe(false);
  });

  it("пустой вызов не ломает ничего", () => {
    expect(ogrynBreaksWeapon()).toBe(false);
  });
});

describe("ogrynBreakApplies: когда куб вообще катается", () => {
  it("Огрин, рукопашная, оружие не огринское — катаем", () => {
    expect(ogrynBreakApplies({ actor: ogrynActor(), isMelee: true, hasOgrynized: false })).toBe(true);
  });

  it("человек — не катаем (признак сложения даёт раса)", () => {
    expect(ogrynBreakApplies({ actor: humanActor(), isMelee: true, hasOgrynized: false })).toBe(false);
  });

  it("огринское оружие и стрельба — не катаем", () => {
    expect(ogrynBreakApplies({ actor: ogrynActor(), isMelee: true, hasOgrynized: true })).toBe(false);
    expect(ogrynBreakApplies({ actor: ogrynActor(), isMelee: false, hasOgrynized: false })).toBe(false);
  });
});

describe("ogrynBreakNote: что видно в карточке", () => {
  it("сломалось — назван бросок и время починки", () => {
    const note = ogrynBreakNote({ roll: { total: 2 }, broken: true }, "Цепной Меч");
    expect(note).toContain("Цепной Меч");
    expect(note).toContain("1d10 = 2");
    expect(note).toContain("½ смены");
  });

  it("выдержало — тоже видно, и бросок назван", () => {
    const note = ogrynBreakNote({ roll: { total: 8 }, broken: false }, "Цепной Меч");
    expect(note).toContain("1d10 = 8");
    expect(note).not.toContain("½ смены");
  });

  it("броска не было — строки нет вовсе", () => {
    expect(ogrynBreakNote(null, "Цепной Меч")).toBe("");
  });
});
