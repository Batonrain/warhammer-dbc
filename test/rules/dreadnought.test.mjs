// Пилот Дредноута (Книга Машин, стр. 57-58): связь «актор ↔ саркофаг»,
// максимум Здравомыслия и пороги Безумия.

import { describe, it, expect } from "vitest";
import {
  isDreadnought, pilotUuidOf, dreadnoughtOf, isDreadnoughtPilot,
  sanityMax, madnessLevels, DREADNOUGHT_PILOT_FLAG
} from "../../module/rules/dreadnought.mjs";

const dread = (pilotUuid = "", over = {}) => ({
  type: "vehicle", uuid: "Actor.dread1",
  system: {
    vehicleClass: "Дредноут", vehicleType: "walker",
    stations: [{ id: "s1", role: "pilot", uuid: pilotUuid }],
    ...over
  }
});
const tank = () => ({
  type: "vehicle", uuid: "Actor.tank1",
  system: { vehicleClass: "Танк", vehicleType: "tracked",
            stations: [{ id: "s1", role: "pilot", uuid: "Actor.hero" }] }
});

describe("что считается Дредноутом", () => {
  it("класс техники из книги", () => {
    expect(isDreadnought(dread())).toBe(true);
    expect(isDreadnought(tank())).toBe(false);
  });

  it("не техника — не Дредноут, чем бы её ни назвали", () => {
    expect(isDreadnought({ type: "character", system: { vehicleClass: "Дредноут" } })).toBe(false);
    expect(isDreadnought(null)).toBe(false);
  });

  it("класс сверяется без оглядки на регистр и пробелы", () => {
    expect(isDreadnought(dread("", { vehicleClass: "  дредноут " }))).toBe(true);
  });
});

describe("кто пилот", () => {
  it("берётся из места экипажа с ролью pilot", () => {
    expect(pilotUuidOf(dread("Actor.hero"))).toBe("Actor.hero");
  });

  it("пустое место пилота — никто", () => {
    expect(pilotUuidOf(dread())).toBe("");
    expect(pilotUuidOf({ system: { stations: [] } })).toBe("");
  });

  it("прочие роли экипажа пилотом не считаются", () => {
    const withGunner = { type: "vehicle", system: { vehicleClass: "Дредноут",
      stations: [{ role: "gunner", uuid: "Actor.other" }] } };
    expect(pilotUuidOf(withGunner)).toBe("");
  });
});

describe("dreadnoughtOf: найти свой саркофаг", () => {
  const all = [tank(), dread("Actor.hero")];

  it("находит Дредноут, где актор назначен пилотом", () => {
    expect(dreadnoughtOf("Actor.hero", all)?.uuid).toBe("Actor.dread1");
    expect(isDreadnoughtPilot("Actor.hero", all)).toBe(true);
  });

  it("пилот танка пилотом Дредноута не является", () => {
    expect(isDreadnoughtPilot("Actor.tanker", all)).toBe(false);
  });

  it("пустой uuid не совпадает с пустым местом экипажа", () => {
    // Иначе КАЖДЫЙ актор оказался бы пилотом любого пустого Дредноута.
    expect(isDreadnoughtPilot("", [dread()])).toBe(false);
  });

  it("имя возможности объявлено рядом с правилом, а не рассыпано строкой", () => {
    expect(DREADNOUGHT_PILOT_FLAG).toBe("pilot.dreadnought");
  });
});

describe("Здравомыслие: максимум", () => {
  it("50 + 2×W.b — как в книге", () => {
    expect(sanityMax(4)).toBe(58);
    expect(sanityMax(0)).toBe(50);
  });

  it("«Ядро Воспоминаний» добавляет по 5 за каждый взятый раз", () => {
    expect(sanityMax(4, 3)).toBe(58 + 15);
  });

  it("отрицательный бонус Воли не уводит максимум ниже 50", () => {
    expect(sanityMax(-3)).toBe(50);
  });
});

describe("Безумие Дредноута: пороги", () => {
  it("на полном Здравомыслии эффектов нет", () => {
    expect(madnessLevels(58)).toEqual([]);
  });

  it("пороги срабатывают на «столько или ниже» и складываются", () => {
    expect(madnessLevels(50)).toEqual([50]);
    expect(madnessLevels(35)).toEqual([50, 40]);
    expect(madnessLevels(10)).toEqual([50, 40, 30, 20, 10]);
  });

  it("ноль добавляет перманентную Ярость поверх всего", () => {
    expect(madnessLevels(0)).toEqual([50, 40, 30, 20, 10, 0]);
    expect(madnessLevels(-5)).toEqual([50, 40, 30, 20, 10, 0]);
  });
});
