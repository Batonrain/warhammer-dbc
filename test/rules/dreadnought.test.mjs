// Пилот Дредноута (Книга Машин, стр. 57-58): связь «актор ↔ саркофаг»,
// максимум Здравомыслия и пороги Безумия.

import { describe, it, expect } from "vitest";
import {
  isDreadnought, pilotUuidOf, dreadnoughtOf, isDreadnoughtPilot,
  sanityMax, madnessLevels, DREADNOUGHT_PILOT_FLAG,
  pilotDamageThreshold, pilotWoundsAfter,
  SANITY_RECOVERY_TALENTS, sanityRecoveryTalentsOf,
  dailyWillTestOutcome, hasElectrostimulators, electrostimulatorBoost,
  hasFerumInfernus, ferumInfernusThreshold, ferumInfernusActive
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

describe("Урон Дредноуту ранит пилота: порог", () => {
  it("½W.b, округлённый вверх", () => {
    expect(pilotDamageThreshold(4)).toBe(2);
    expect(pilotDamageThreshold(5)).toBe(3);
  });
  it("W.b 0 — порог 0 (любой непоглощённый урон ранит)", () => {
    expect(pilotDamageThreshold(0)).toBe(0);
  });
  it("отрицательный бонус не уводит порог в минус", () => {
    expect(pilotDamageThreshold(-3)).toBe(0);
  });
});

describe("Урон Дредноуту ранит пилота: Раны пилота", () => {
  it("урон меньше текущих Ран — просто вычитается", () => {
    const after = pilotWoundsAfter({ wounds: { value: 10, critical: 0 } }, 4);
    expect(after).toEqual({ value: 6, critical: 0, overflow: false });
  });
  it("урон точно добивает до нуля — без перехода в критические", () => {
    const after = pilotWoundsAfter({ wounds: { value: 4, critical: 0 } }, 4);
    expect(after).toEqual({ value: 0, critical: 0, overflow: false });
  });
  it("урон больше Ран — остаток идёт в Критические", () => {
    const after = pilotWoundsAfter({ wounds: { value: 3, critical: 1 } }, 7);
    expect(after).toEqual({ value: 0, critical: 5, overflow: true });
  });
  it("нулевой урон ничего не меняет", () => {
    const after = pilotWoundsAfter({ wounds: { value: 8, critical: 0 } }, 0);
    expect(after).toEqual({ value: 8, critical: 0, overflow: false });
  });
});

describe("Здравомыслие: Таланты разового восстановления 2d10", () => {
  it("без Талантов на листе — пустой список", () => {
    expect(sanityRecoveryTalentsOf([])).toEqual([]);
    expect(sanityRecoveryTalentsOf(undefined)).toEqual([]);
  });

  it("узнаёт каждый из четырёх Талантов по точному имени из пака", () => {
    const packNames = {
      cruelty: "Cruelty / Жестокость (Дредноут)",
      endurance: "Endurance / Превозмогание",
      superiority: "Superiority / Превосходство",
      triumph: "Triumph / Триумф"
    };
    expect(Object.keys(packNames).sort()).toEqual(SANITY_RECOVERY_TALENTS.map(t => t.key).sort());
    for (const t of SANITY_RECOVERY_TALENTS) {
      const items = [{ type: "talent", name: packNames[t.key] }];
      expect(sanityRecoveryTalentsOf(items).map(x => x.key)).toEqual([t.key]);
    }
  });

  it("не-Таланты и чужие Таланты не подходят", () => {
    const items = [
      { type: "trait", name: "Triumph / Триумф" },
      { type: "talent", name: "Iron Wrath / Железный Гнев" }
    ];
    expect(sanityRecoveryTalentsOf(items)).toEqual([]);
  });

  it("несколько Талантов сразу — все в списке", () => {
    const items = [
      { type: "talent", name: "Cruelty / Жестокость (Дредноут)" },
      { type: "talent", name: "Triumph / Триумф" }
    ];
    expect(sanityRecoveryTalentsOf(items).map(t => t.key).sort()).toEqual(["cruelty", "triumph"]);
  });
});

describe("Здравомыслие: суточный тест бодрствования (W+0)", () => {
  it("успех — Здравомыслие не теряется", () => {
    expect(dailyWillTestOutcome(50, 50)).toEqual({ success: true, degrees: 1, sanityLoss: 0 });
    expect(dailyWillTestOutcome(1, 50)).toEqual({ success: true, degrees: 5, sanityLoss: 0 });
  });

  it("провал — потеря равна числу Провалов", () => {
    expect(dailyWillTestOutcome(51, 50)).toEqual({ success: false, degrees: 1, sanityLoss: 1 });
    expect(dailyWillTestOutcome(71, 50)).toEqual({ success: false, degrees: 3, sanityLoss: 3 });
  });

  it("отрицательный/нечисловой W считается нулевым порогом", () => {
    expect(dailyWillTestOutcome(1, -5).success).toBe(false);
    expect(dailyWillTestOutcome(1, undefined).success).toBe(false);
  });
});

describe("Электростимуляторы: снаряжение на Дредноуте", () => {
  it("узнаёт предмет по типу и имени из пака", () => {
    const items = [{ type: "vehicleGear", name: "Электростимуляторы / Electrostimulators" }];
    expect(hasElectrostimulators(items)).toBe(true);
  });
  it("другое снаряжение или другой тип предмета не подходит", () => {
    expect(hasElectrostimulators([{ type: "vehicleGear", name: "Cyberleash / Киберпривязь" }])).toBe(false);
    expect(hasElectrostimulators([{ type: "gear", name: "Электростимуляторы / Electrostimulators" }])).toBe(false);
  });
  it("без снаряжения или без списка — нет", () => {
    expect(hasElectrostimulators([])).toBe(false);
    expect(hasElectrostimulators(undefined)).toBe(false);
  });
});

describe("Электростимуляторы: разовое восстановление и откат", () => {
  it("10 + 2×W.b, задержка отката 2×W.b минут", () => {
    expect(electrostimulatorBoost(4)).toEqual({ amount: 18, delayMinutes: 8 });
    expect(electrostimulatorBoost(0)).toEqual({ amount: 10, delayMinutes: 0 });
  });
  it("отрицательный бонус не уводит числа в минус", () => {
    expect(electrostimulatorBoost(-3)).toEqual({ amount: 10, delayMinutes: 0 });
  });
});

describe("Ферум Инфернус: Талант и порог", () => {
  it("узнаёт Талант по имени из пака", () => {
    expect(hasFerumInfernus([{ type: "talent", name: "Ferum Infernus / Ферум Инфернус" }])).toBe(true);
    expect(hasFerumInfernus([{ type: "trait", name: "Ferum Infernus / Ферум Инфернус" }])).toBe(false);
    expect(hasFerumInfernus([])).toBe(false);
  });

  it("порог — ½Inf+5, округление вверх (конвенция главы)", () => {
    expect(ferumInfernusThreshold(40)).toBe(25);
    expect(ferumInfernusThreshold(41)).toBe(26);
    expect(ferumInfernusThreshold(0)).toBe(5);
  });

  it("отрицательный Inf не уводит порог ниже 5", () => {
    expect(ferumInfernusThreshold(-10)).toBe(5);
  });

  it("активна строго ниже порога, не на нём", () => {
    expect(ferumInfernusActive(24, 40)).toBe(true);
    expect(ferumInfernusActive(25, 40)).toBe(false);
    expect(ferumInfernusActive(26, 40)).toBe(false);
  });
});
