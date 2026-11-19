// test/rules/pact-disorder.test.mjs
//
// Неизлечимые расстройства Пактов (корбук, Глава 3): нижний предел Тяжести —
// книжное число плюс старшая купленная Стадия Пакта (rules/pact-disorder.mjs);
// четыре Черты выдают своё расстройство при получении.

import { describe, it, expect } from "vitest";
import { pactStageOf, pactStage, pactDisorderFloor, pactFloorUpdates, PACT_FLOOR_FLAG }
  from "../../module/rules/pact-disorder.mjs";
import { DISORDER_LIBRARY } from "../../module/constants/fear-tables.mjs";
import { packDocByFileHint } from "../support/pack-doc.mjs";

const stage = (name) => ({ type: "talent", name });
const disorder = (name, severityMin, base) => ({
  type: "mentalDisorder", name, system: { severity: 0, severityMin },
  flags: base === undefined ? {} : { "warhammer-dbc": { [PACT_FLOOR_FLAG]: base } }
});

describe("Стадия Пакта", () => {
  it("общие и именные Стадии опознаются, прочее — нет", () => {
    expect(pactStageOf(stage("Pact Stage 3 / Стадия Пакта 3"))).toBe(3);
    expect(pactStageOf(stage("Cogitor Pact Stage 2 / Стадия Пакта 2 (Когитор)"))).toBe(2);
    expect(pactStageOf(stage("Pact Protection / Защита Пакта"))).toBe(0);
    expect(pactStageOf({ type: "trait", name: "Pact Stage 1" })).toBe(0);
  });

  it("берётся старшая купленная", () => {
    expect(pactStage({ items: [] })).toBe(0);
    expect(pactStage({ items: [stage("Pact Stage 1"), stage("Pact Stage 4"), stage("Pact Stage 2")] })).toBe(4);
  });

  it("предел: книжное число + Стадия, не выше 5", () => {
    expect(pactDisorderFloor(-1, 0)).toBe(-1);
    expect(pactDisorderFloor(-1, 2)).toBe(1);
    expect(pactDisorderFloor(0, 5)).toBe(5);
    expect(pactDisorderFloor(3, 5)).toBe(5);
    expect(pactDisorderFloor(null, 2)).toBe(null);
  });
});

describe("подъём предела после покупки Стадии", () => {
  it("поднимает только выданные Пактом и только вверх", () => {
    const pact = disorder("Психопатия", -1, -1);
    const other = disorder("Фобия", null);
    const manual = disorder("Сноб", 4, 0);   // ГМ уже поднял руками выше
    const actor = { items: [stage("Cogitor Pact Stage 2 / Стадия Пакта 2 (Когитор)"), pact, other, manual] };
    const ups = pactFloorUpdates(actor);
    expect(ups).toEqual([{ item: pact, floor: 1 }]);
  });

  it("без Стадий поднимать нечего", () => {
    expect(pactFloorUpdates({ items: [disorder("Психопатия", -1, -1)] })).toEqual([]);
  });
});

describe("данные пака", () => {
  const P = "packs-src/traits/Элитные_архетипы";
  const CASES = [
    ["Когитор/Dream_Chaser___Гоняющийся_за_Мечтой_xOX8NAa4NQz5ua2o.json", "Психопатия", -1, true],
    ["Мейстер/Deathless_Oath___Несмертная_Клятва_r5AlyIg1MJQzyzD4.json", "Сноб", 0, true],
    ["Ревенант/Vengeful_One___Мстительный_zaCpcGstAokLugzn.json", "Ненависть", 0, true],
    ["Вампир/Supreme_Avarice___Высшая_Алчность_yCWcldQONAj8RBn3.json", "Перфекционизм", -2, false]
  ];
  for (const [file, dis, min, scaled] of CASES) {
    it(`${file.split("/")[0]}: выдаёт «${dis}» при получении`, () => {
      const d = packDocByFileHint(`${P}/${file}`);
      const e = d.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(x => x.kind === "script");
      expect(e.scriptOnGrant).toBe(true);
      expect(e.code).toContain(`name: "${dis}"`);
      expect(e.code).toContain(`severityMin: ${min}`);
      expect(e.code).toContain(`pactScaled: ${scaled}`);
      expect(DISORDER_LIBRARY.some(x => x.name === dis)).toBe(true);
    });
  }
});
