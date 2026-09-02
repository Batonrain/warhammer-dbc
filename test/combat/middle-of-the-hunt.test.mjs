// test/combat/middle-of-the-hunt.test.mjs
//
// The Middle of the Hunt / Середина Охоты (wdbc-1rno): «+10 к своей
// Инициативе в начале 3-го и 4-го раунда» — не «доп. Ход», книжный текст
// проще раннего пересказа находки. module/combat/middle-of-the-hunt.mjs.

import { describe, it, expect } from "vitest";
import { hasMiddleOfTheHunt, processMiddleOfTheHuntRoundStart } from "../../module/combat/middle-of-the-hunt.mjs";

const actorWith = (...names) => ({
  items: names.map(name => ({ type: "talent", name }))
});

function combatant(actor, initiative = 10) {
  const flags = {};
  const c = {
    actor, initiative,
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    update: async data => { if (data.initiative !== undefined) c.initiative = data.initiative; }
  };
  return c;
}

describe("hasMiddleOfTheHunt", () => {
  it("находит Талант по билингвальному имени", () => {
    expect(hasMiddleOfTheHunt(actorWith("The Middle of the Hunt / Середина Охоты"))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasMiddleOfTheHunt(actorWith("Dodge"))).toBe(false);
  });
});

describe("processMiddleOfTheHuntRoundStart", () => {
  it("раунд 3: владелец Таланта получает +10 к Инициативе", async () => {
    const actor = actorWith("The Middle of the Hunt / Середина Охоты");
    const c = combatant(actor, 15);
    await processMiddleOfTheHuntRoundStart({ round: 3, combatants: [c] });
    expect(c.initiative).toBe(25);
  });

  it("раунд 4: тоже получает +10", async () => {
    const actor = actorWith("The Middle of the Hunt / Середина Охоты");
    const c = combatant(actor, 20);
    await processMiddleOfTheHuntRoundStart({ round: 4, combatants: [c] });
    expect(c.initiative).toBe(30);
  });

  it("раунд 1/2/5 — бонус не применяется", async () => {
    const actor = actorWith("The Middle of the Hunt / Середина Охоты");
    for (const round of [1, 2, 5]) {
      const c = combatant(actor, 15);
      await processMiddleOfTheHuntRoundStart({ round, combatants: [c] });
      expect(c.initiative).toBe(15);
    }
  });

  it("нет Таланта — бонус не применяется", async () => {
    const c = combatant(actorWith("Dodge"), 15);
    await processMiddleOfTheHuntRoundStart({ round: 3, combatants: [c] });
    expect(c.initiative).toBe(15);
  });

  it("повторный вызов того же раунда не прибавляет бонус дважды", async () => {
    const actor = actorWith("The Middle of the Hunt / Середина Охоты");
    const c = combatant(actor, 15);
    await processMiddleOfTheHuntRoundStart({ round: 3, combatants: [c] });
    await processMiddleOfTheHuntRoundStart({ round: 3, combatants: [c] });
    expect(c.initiative).toBe(25);
  });

  it("новый раунд (3 → 4) снова применяет бонус", async () => {
    const actor = actorWith("The Middle of the Hunt / Середина Охоты");
    const c = combatant(actor, 15);
    await processMiddleOfTheHuntRoundStart({ round: 3, combatants: [c] });
    await processMiddleOfTheHuntRoundStart({ round: 4, combatants: [c] });
    expect(c.initiative).toBe(35);
  });

  it("нет combat — не падает", async () => {
    await expect(processMiddleOfTheHuntRoundStart(null)).resolves.toBeUndefined();
  });
});
