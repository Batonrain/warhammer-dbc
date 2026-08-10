// Шаг 3.2 плана: проверки `system.race === "astartes"` в листе персонажа
// заменены запросом к правилам (module/rules/flags.mjs). Тест держит поведение:
// у Астартес всё как раньше, у человека — как раньше.
//
// Заглушка Foundry нужна только для загрузки листа (он наследует класс из
// foundry.appv1), в расчёт она не входит — см. test/support/foundry-stub.mjs.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, sheetOf } from "../support/foundry-stub.mjs";

const { WarhammerCharacterSheet } = await import("../../module/sheets/actor-sheet.mjs");

const medic = () => sheetOf(WarhammerCharacterSheet, {
  race: "human",
  characteristics: { int: { total: 40, value: 40, bonus: 4 } },
  skills: { medicae: { total: 45 } }
});

/** Пациент с лёгким ранением: потеряно 2 Раны при T.b 4. */
const patient = (race, updates = []) => ({
  name: race === "astartes" ? "Брат" : "Человек",
  system: {
    race,
    size: race === "astartes" ? 1 : 0,
    characteristics: { t: { total: 45, value: 45, bonus: 4 } },
    wounds: { value: 18, max: 20, critical: 0 }
  },
  items: [],
  update: async data => { updates.push(data); return data; }
});

beforeEach(resetCaptured);

describe("папка талантов «Геносемя»", () => {
  it("открыта Астартес", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, { race: "astartes", size: 1 });
    expect(sheet._talentGroupLock("talent", "", "Геносемя")).toBeNull();
  });

  it("закрыта человеку", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, { race: "human" });
    expect(sheet._talentGroupLock("talent", "", "Геносемя")).toMatch(/Геносемя/);
  });
});

describe("лечение: физиология Астартес", () => {
  const heal = (race, mode) => {
    const updates = [];
    return medic()._applyHealing(patient(race, updates), { mode, care: false, mod: 0, bonus: 0 })
      .then(() => ({ updates, content: captured.chat[0]?.content ?? "" }));
  };

  // Пассивное лечение считается Отдыхом, Отдых — Постельным режимом. При T.b 4
  // и лёгком ранении это 2 восстановленные Раны вместо 1.
  it("пассивное лечение Астартес считается Отдыхом", async () => {
    const { updates, content } = await heal("astartes", "passive");
    expect(content).toContain("считается как «Отдых»");
    expect(updates).toEqual([{ "system.wounds.value": 20, "system.wounds.critical": 0 }]);
  });

  it("у человека пассивное лечение остаётся пассивным", async () => {
    const { updates, content } = await heal("human", "passive");
    expect(content).not.toContain("считается как");
    expect(updates).toEqual([{ "system.wounds.value": 19, "system.wounds.critical": 0 }]);
  });

  it("Отдых Астартес считается Постельным режимом", async () => {
    const { updates, content } = await heal("astartes", "rest");
    expect(content).toContain("считается как «Постельный режим»");
    expect(updates).toEqual([{ "system.wounds.value": 20, "system.wounds.critical": 0 }]);
  });
});
