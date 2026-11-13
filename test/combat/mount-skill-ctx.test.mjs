// test/combat/mount-skill-ctx.test.mjs
//
// Sahara task-55d0: тесты верхом (Поворот, Занос, Ландшафт, Седло, Лезвия, Железный Скакун) идут через общий
// исход теста (rules/kind-outcome.mjs), но не сообщали ему, каким Навыком бросали: ни skill, ни group. Поэтому
// правила «область = Навык» (failDegMod, Крит. диапазон, Инфернальная Воля «любой тест Навыка») на верховых
// тестах молчали. Проверка — через failDegMod с областью на конкретный Навык: степень провала растёт на 3
// только если исход знает Навык; для несовпавшей области (контроль) степень та же, что без правила.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeHtml, fakeForm } from "../support/foundry-stub.mjs";
import {
  showTurnDialog, showSkidDialog, showMountTerrainDialog, saddleTest, showBladesDialog, ironMountTest
} from "../../module/combat/mount.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();
const realFromUuid = globalThis.fromUuid;
const flush = () => new Promise(r => setTimeout(r, 0));

const beast = ({ items = [] } = {}) => ({
  type: "character", uuid: "Actor.beast", items, name: "Скакун",
  system: { size: 1, initiative: 3, movement: { halfMove: 8 }, wounds: { value: 14, max: 14, critical: 0 } }
});
const bike = () => ({
  type: "vehicle", uuid: "Actor.beast", items: [], name: "Байк",
  system: { size: 1, initiative: 0, chassis: { type: "wheeled", spd: 8 }, structure: { value: 6, max: 6, critical: 0 } }
});
const rider = ({ speed = "half" } = {}) => ({
  type: "character", uuid: "Actor.rider", items: [], name: "Всадник",
  system: {
    size: 0, initiative: 5,
    characteristics: { ag: { total: 40 }, per: { total: 30, bonus: 3 } },
    skills: { survival: { rank: "trained", total: 10 }, acrobatics: { rank: "trained", total: 10 } },
    groupSkills: { operate: [] },
    mount: { uuid: "Actor.beast", role: "rider", speed, bladesUsed: 0 }
  },
  getFlag: () => undefined, setFlag: async () => {}, update: async () => {}
});

/** Правило «+3 к степени провала» в заданной области. */
const failPlus3 = target => registerRuleSource("test-mount-ctx", () => [{
  id: "r", effects: [{ kind: "failDegMod", target, value: 3 }]
}]);

const failDeg = () => {
  const m = (captured.chat.at(-1)?.content ?? "").match(/Провал — (\d+)/);
  return m ? Number(m[1]) : null;
};

beforeEach(() => { resetCaptured(); clearRuleSources(); });
afterEach(() => {
  globalThis.fromUuid = realFromUuid;
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

/**
 * Прогнать сценарий дважды — с правилом в области `scope` и с правилом в заведомо чужой области — и вернуть
 * разницу степеней провала. 3 — исход знает Навык; 0 — не знает.
 */
async function delta(scope, scenario) {
  const run = async rule => {
    resetCaptured(); clearRuleSources();
    failPlus3(rule);
    await scenario();
    const d = failDeg();
    expect(d, "в карточке есть провал").not.toBeNull();
    return d;
  };
  return (await run(scope)) - (await run("skill:charm"));
}

const turnScenario = (mount, speed = "half") => async () => {
  globalThis.fromUuid = async () => mount;
  showTurnDialog(rider({ speed }));
  await flush();
  captured.nextRoll = 99;
  await captured.dialog.buttons.roll.callback(fakeHtml({ "#mt-angle": "1", "#mt-mod": "0" }));
};

describe("Верховая карточка показывает надбавку Сверхъестественной Характеристики", () => {
  it("Unnatural Agility (2) на Повороте: строка с объяснением есть в карточке", async () => {
    globalThis.fromUuid = async () => beast();
    const r = rider({ speed: "half" });
    r.items = [{ type: "trait", name: "Unnatural Agility (2) / Сверхъест. Ловкость", system: { effects: { charBonuses: [{ stat: "ag", value: 2 }] } } }];
    showTurnDialog(r);
    await flush();
    captured.nextRoll = 3;
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#mt-angle": "1", "#mt-mod": "0" }));
    expect(captured.chat.at(-1).content).toContain("Сверхъестественная Характеристика");
  });
});

describe("Верховые тесты сообщают исходу Навык управления", () => {
  it("Поворот на байке: Operate — область skill:operate срабатывает", async () => {
    expect(await delta("skill:operate", turnScenario(bike()))).toBe(3);
  });

  it("Поворот на живом скакуне: Survival — область skill:survival срабатывает", async () => {
    expect(await delta("skill:survival", turnScenario(beast()))).toBe(3);
  });

  it("область anyskill (Инфернальная Воля) видит верховой тест как тест Навыка", async () => {
    expect(await delta("anyskill", turnScenario(bike()))).toBe(3);
  });

  it("Занос: Survival", async () => {
    const scenario = async () => {
      globalThis.fromUuid = async () => beast();
      const p = showSkidDialog(rider({ speed: "charge" }));
      await flush();
      captured.nextRoll = 99;
      await captured.press("roll", fakeForm());
      await p;
    };
    expect(await delta("skill:survival", scenario)).toBe(3);
  });

  it("Трудный Ландшафт: Operate на байке", async () => {
    const scenario = async () => {
      globalThis.fromUuid = async () => bike();
      showMountTerrainDialog(rider({ speed: "full" }));
      await flush();
      captured.nextRoll = 99;
      await captured.dialog.buttons.roll.callback(fakeHtml({ "#mtt-skill": "40", "#mtt-zone": "0", "#mtt-mod": "0" }));
    };
    expect(await delta("skill:operate", scenario)).toBe(3);
  });

  it("Удержаться в седле (Навык управления): Survival", async () => {
    const scenario = async () => {
      globalThis.fromUuid = async () => beast();
      const p = saddleTest(rider(), { kind: "control", mod: 0, reason: "проверка" });
      await flush();
      captured.nextRoll = 99;
      await captured.press("roll", fakeForm());
      await p;
    };
    expect(await delta("skill:survival", scenario)).toBe(3);
  });

  it("Удержаться в седле (Акробатика): skill:acrobatics", async () => {
    const scenario = async () => {
      globalThis.fromUuid = async () => beast();
      const p = saddleTest(rider(), { kind: "acrobatics", mod: 0, reason: "проверка" });
      await flush();
      captured.nextRoll = 99;
      await captured.press("roll", fakeForm());
      await p;
    };
    expect(await delta("skill:acrobatics", scenario)).toBe(3);
  });

  it("Удержаться в седле (Ловкость): это тест Характеристики — anyskill не срабатывает, char:ag — да", async () => {
    const scenario = async () => {
      globalThis.fromUuid = async () => beast();
      const p = saddleTest(rider(), { kind: "agility", mod: 0, reason: "проверка" });
      await flush();
      captured.nextRoll = 99;
      await captured.press("roll", fakeForm());
      await p;
    };
    expect(await delta("anyskill", scenario)).toBe(0);
    expect(await delta("char:ag", scenario)).toBe(3);
  });

  it("Лезвия: Survival", async () => {
    const scenario = async () => {
      globalThis.fromUuid = async () => beast({ items: [{ type: "trait", name: "Blades / Лезвия (X)", system: { rating: 5 } }] });
      const p = showBladesDialog(rider());
      await flush();
      captured.nextRoll = 99;
      await captured.press("roll", fakeForm());
      await p;
    };
    expect(await delta("skill:survival", scenario)).toBe(3);
  });

  it("Железный Скакун: Survival", async () => {
    const scenario = async () => {
      globalThis.fromUuid = async () => beast();
      const r = rider();
      r.items = [{ type: "talent", name: "Iron Mount / Железный Скакун", system: {}, flags: {} }];
      r.system.actionPoints = { value: 2, max: 2 };
      r.system.conditions = {};
      captured.nextRoll = 99;
      await ironMountTest(r);
    };
    expect(await delta("skill:survival", scenario)).toBe(3);
  });
});
