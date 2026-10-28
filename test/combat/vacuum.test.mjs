// test/combat/vacuum.test.mjs
//
// Вакуум (core стр. 483, trade-voidfarer-10-wdbc-dbveg) — rollVacuumTest:
// флаг сцены как источник теста, Порог T+0 / Voidfarer T+10 / задержка дыхания
// −30, непоглощаемый урон по Провалам (+1d5), Blinding(0) при открытых
// глазах, защита пустотной бронёй, Преимущество Крепкого как Камень.
// Крепкая Черта — НАСТОЯЩИЙ документ packs-src. Кубы — очередь captured.dice.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { rollVacuumTest, processVacuumTurnStart, sceneIsVacuum, actorInStartedCombat } from "../../module/combat/vacuum.mjs";

const STONE = packDocById("packs-src/traits", "IsGR11cplUwRIuZv");

const VACUUM_SCENE = { getFlag: () => ({ vacuum: true }) };
const AIR_SCENE = { getFlag: () => ({ vacuum: false }) };

function makeActor({ t = 40, per = 40, wounds = 20, items = [], voidfarer = null, flags = {} } = {}) {
  const store = { ...flags };
  const list = Object.assign([...items], { contents: items });
  const actor = {
    type: "character", name: "Подставной", items: list,
    system: {
      characteristics: { t: { total: t, bonus: Math.floor(t / 10) }, per: { total: per }, int: { total: 35 } },
      groupSkills: { trade: voidfarer ? [voidfarer] : [] },
      wounds: { value: wounds, critical: 0, max: wounds },
      conditions: {}
    },
    getFlag: (_s, k) => store[k],
    update: async data => {
      for (const [path, v] of Object.entries(data)) {
        const m = path.match(/^flags\.warhammer-dbc\.(.+)$/);
        if (m) { store[m[1]] = v; continue; }
        const parts = path.split(".");
        let node = actor;
        for (const p of parts.slice(0, -1)) node = (node[p] ??= {});
        node[parts.at(-1)] = v;
      }
    }
  };
  return actor;
}

const armour = (props, over = {}) => ({ type: "armor", name: "Пустотный доспех", system: { equipped: true, breached: false, properties: props, ...over } });
const stoneItem = { id: "st", name: STONE.name, type: STONE.type, system: STONE.system, flags: STONE.flags };

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { scene: null };
  globalThis.game.scenes = { current: null };
  globalThis.game.time = { worldTime: 0 };
});

describe("sceneIsVacuum", () => {
  it("читает флаг окна «Окружение»", () => {
    expect(sceneIsVacuum(VACUUM_SCENE)).toBe(true);
    expect(sceneIsVacuum(AIR_SCENE)).toBe(false);
    expect(sceneIsVacuum({ getFlag: () => undefined })).toBe(false);
    expect(sceneIsVacuum(null)).toBe(false);
  });
});

describe("rollVacuumTest — отказы без броска", () => {
  it("воздух есть — ничего не катается", async () => {
    const a = makeActor();
    expect(await rollVacuumTest(a, { scene: AIR_SCENE })).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });

  it("пустотная броня — защищает, ничего не катается", async () => {
    const a = makeActor({ items: [armour(["void"])] });
    expect(await rollVacuumTest(a, { scene: VACUUM_SCENE })).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });

  it("пробитая броня не защищает — тест идёт", async () => {
    const a = makeActor({ items: [armour(["void"], { breached: true })] });
    captured.dice = [10];
    expect(await rollVacuumTest(a, { scene: VACUUM_SCENE, eyesClosed: true })).toBe(true);
    expect(captured.chat).toHaveLength(1);
  });

  it("кнопка без вакуума говорит об этом уведомлением", async () => {
    const info = [];
    globalThis.ui.notifications.info = m => info.push(m);
    await rollVacuumTest(makeActor(), { scene: AIR_SCENE, manual: true });
    expect(info.some(m => m.includes("Воздух есть"))).toBe(true);
  });
});

describe("rollVacuumTest — тест T+0 и урон", () => {
  it("успех: Раны целы, карточка «Успех»", async () => {
    const a = makeActor({ t: 40, wounds: 20 });
    captured.dice = [30];
    await rollVacuumTest(a, { scene: VACUUM_SCENE, eyesClosed: true });
    expect(a.system.wounds.value).toBe(20);
    expect(captured.chat[0].content).toContain("Успех");
  });

  it("провал на 3 степени: ровно 3 непоглощаемого урона по Ранам (62 против 40: 3 Провала)", async () => {
    const a = makeActor({ t: 40, wounds: 20 });
    captured.dice = [62];
    await rollVacuumTest(a, { scene: VACUUM_SCENE, eyesClosed: true });
    expect(a.system.wounds.value).toBe(17);
    const html = captured.chat[0].content;
    expect(html).toContain("Провал");
    expect(html).toContain("3 непоглощаемого X Dmg в Торс");
  });

  it("задержка дыхания: Порог −30 и +1d5 урона при провале", async () => {
    const a = makeActor({ t: 40, wounds: 20 });
    // Порог 10; бросок 35 → 3 Провала; кубик дыхания 4 → 7 урона.
    captured.dice = [35, 4];
    await rollVacuumTest(a, { scene: VACUUM_SCENE, holdBreath: true, eyesClosed: true });
    expect(a.system.wounds.value).toBe(13);
    expect(captured.chat[0].content).toContain("7 непоглощаемого X Dmg");
  });

  it("задержка дыхания при успехе кубик +1d5 не катается", async () => {
    const a = makeActor({ t: 40, wounds: 20 });
    captured.dice = [5];
    await rollVacuumTest(a, { scene: VACUUM_SCENE, holdBreath: true, eyesClosed: true });
    expect(captured.rolls.filter(f => f === "1d5")).toHaveLength(0);
    expect(a.system.wounds.value).toBe(20);
  });

  it("Voidfarer: Порог 50 вместо 40 — бросок 48 уже успех", async () => {
    const a = makeActor({ t: 40, voidfarer: { specKey: "voidfarer", rank: "knows", total: 35 } });
    captured.dice = [48];
    await rollVacuumTest(a, { scene: VACUUM_SCENE, eyesClosed: true });
    expect(captured.chat[0].content).toContain("Успех");
    expect(captured.chat[0].content).toContain("Trade (Voidfarer)");
  });

  it("запомненные галочки актора действуют на тест начала Хода", async () => {
    const a = makeActor({ t: 40, wounds: 20, flags: { vacuumHoldBreath: true, vacuumEyesClosed: true } });
    captured.dice = [35, 2];
    await processVacuumTurnStart(a, { parent: VACUUM_SCENE });
    expect(a.system.wounds.value).toBe(15); // 3 Провала + 2
  });

  it("начало Хода на сцене с воздухом — тишина", async () => {
    const a = makeActor();
    await processVacuumTurnStart(a, { parent: AIR_SCENE });
    expect(captured.chat).toHaveLength(0);
  });
});

describe("rollVacuumTest — Blinding(0) при открытых глазах", () => {
  it("глаза закрыты — теста Per нет", async () => {
    const a = makeActor();
    captured.dice = [10];
    await rollVacuumTest(a, { scene: VACUUM_SCENE, eyesClosed: true });
    expect(captured.dice).toHaveLength(0);
    expect(captured.chat[0].content).toContain("Глаза закрыты");
  });

  it("глаза открыты, Per провален — Ослеплён на раунд за степень провала", async () => {
    const a = makeActor({ per: 30 });
    // тест T: 10 → успех; Per 30, бросок 52 → 3 Провала → blindedRounds 3
    captured.dice = [10, 52];
    await rollVacuumTest(a, { scene: VACUUM_SCENE, eyesClosed: false });
    expect(a.system.conditions.blinded).toBe(true);
    expect(a.system.conditions.blindedRounds).toBe(3);
  });

  it("глаза открыты, Per пройден — Ослепления нет", async () => {
    const a = makeActor({ per: 60 });
    captured.dice = [10, 20];
    await rollVacuumTest(a, { scene: VACUUM_SCENE, eyesClosed: false });
    expect(a.system.conditions.blinded).toBeFalsy();
  });
});

describe("actorInStartedCombat — кнопка виджета в бою не бросает второй тест", () => {
  const a = { id: "a1" };
  it("в начатом бою — да (по ссылке на актора или по actorId)", () => {
    expect(actorInStartedCombat(a, { started: true, combatants: [{ actor: a }] })).toBe(true);
    expect(actorInStartedCombat(a, { started: true, combatants: [{ actorId: "a1" }] })).toBe(true);
  });
  it("бой не начат, другой участник или боя нет — нет", () => {
    expect(actorInStartedCombat(a, { started: false, combatants: [{ actor: a }] })).toBe(false);
    expect(actorInStartedCombat(a, { started: true, combatants: [{ actorId: "zz" }] })).toBe(false);
    expect(actorInStartedCombat(a, null)).toBe(false);
  });
});

describe("rollVacuumTest — Закалённый Кокон: Преимущество вместо переброса", () => {
  const cocoon = {
    type: "talent", name: "Tempered Cocoon / Закалённый Кокон", system: {},
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: "geneseed.core.temperedCocoon" }] }] } }
  };
  it("два броска, лучший; +10 к Порогу остаётся (40+10: бросок 48 — успех)", async () => {
    const a = makeActor({ t: 40, wounds: 20, items: [cocoon] });
    captured.dice = [90, 48];
    await rollVacuumTest(a, { scene: VACUUM_SCENE, eyesClosed: true });
    expect(a.system.wounds.value).toBe(20);
    expect(captured.chat[0].content).toContain("Закалённый Кокон");
  });
});

describe("rollVacuumTest — Преимущество Крепкого как Камень", () => {
  it("два броска, берётся лучший (меньший) — провал первого спасён вторым", async () => {
    const a = makeActor({ t: 40, wounds: 20, items: [stoneItem] });
    captured.dice = [90, 25];
    await rollVacuumTest(a, { scene: VACUUM_SCENE, eyesClosed: true });
    expect(a.system.wounds.value).toBe(20);
    expect(captured.chat[0].content).toContain("Преимущество (Крепкий как Камень)");
  });

  it("мутация: без Черты второй кубик не катается", async () => {
    const a = makeActor({ t: 40, wounds: 20 });
    captured.dice = [90];
    await rollVacuumTest(a, { scene: VACUUM_SCENE, eyesClosed: true });
    expect(captured.dice).toHaveLength(0);
    expect(a.system.wounds.value).toBeLessThan(20);
  });
});
