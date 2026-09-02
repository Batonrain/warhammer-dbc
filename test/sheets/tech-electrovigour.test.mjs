// test/sheets/tech-electrovigour.test.mjs
//
// Electrovigour / Электрорвение (wdbc-u0by): «Преимущество на тесты Т на
// Техночудеса с типом Компенсатор» — авто-обнаружение (кнопка активации без
// диалога), roll×2 + keepBest на сам тест Компенсатора, не на основной тест
// активации.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { activateTechMiracle } from "../../module/sheets/tabs/tech.mjs";

function makeActor({ items = [] } = {}) {
  return {
    id: "a1", name: "Техномагос",
    items,
    system: {
      cognition: { value: 10, max: 10 },
      energy: { value: 10, max: 10 },
      characteristics: { t: { total: 50 }, int: { total: 40, bonus: 4 } },
      skills: { techUse: { total: 40 } },
      techFocus: [],
      techCompBonus: 0,
      corruptionBonus: 0
    },
    update: async () => {}
  };
}

const compensatorItem = (rating = 2) => ({
  name: "Тестовый Компенсатор",
  system: {
    miracleType: "compensator", rating, energyCost: 5, cognitionCost: 0,
    testSkill: "techUse", testMod: 0, iron: "", damage: "", weaponProps: []
  },
  update: async () => {}
});

const electrovigour = () => ({ type: "talent", name: "Electrovigour / Электрорвение", system: {} });

beforeEach(resetCaptured);

describe("activateTechMiracle: Электрорвение (wdbc-u0by)", () => {
  it("есть Талант — тест Компенсатора катается дважды, берётся лучший (меньший)", async () => {
    const actor = makeActor({ items: [electrovigour()] });
    // Порог Компенсатора: T50 − 10×2 = 30. Очередь: cRoll×2 (80 отброшен, 20 взят), затем основной тест.
    captured.dice = [80, 20, 10];
    await activateTechMiracle(actor, compensatorItem());
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("Электрорвение: Преимущество, отброшено 80");
    expect(msg.content).toContain("бросок 20");
  });

  it("нет Таланта — тест Компенсатора катается один раз", async () => {
    const actor = makeActor({});
    captured.dice = [20, 10];
    await activateTechMiracle(actor, compensatorItem());
    const msg = captured.chat.at(-1);
    expect(msg.content).not.toContain("Электрорвение");
    expect(msg.content).toContain("бросок 20");
  });
});
