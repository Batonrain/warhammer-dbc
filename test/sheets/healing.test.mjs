// test/sheets/healing.test.mjs
//
// wdbc-b82z: новые режимы Лечения (стр. 231-232) — Прижигание, Ампутация,
// Пришивание конечностей, Кома, Лечение болезней. Бионика/Кибернетика
// (открывает Хирургеон) не покрыта — заглушка Hooks.once не хранит колбэк.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { applyHealing, comaWakeRemaining } from "../../module/sheets/tabs/healing.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();

function applyPaths(target, data) {
  for (const [path, value] of Object.entries(data)) {
    const parts = path.split(".");
    let cur = target;
    for (const part of parts.slice(0, -1)) {
      cur[part] ??= {};
      cur = cur[part];
    }
    cur[parts.at(-1)] = value;
  }
}

function person({ items = [], fatigue = 0, t = 40, wp = 30, medicae = 40 } = {}) {
  const updates = [];
  const flags = {};
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = {
    name: "Подставной",
    updates,
    items: list,
    system: {
      fatigue: { value: fatigue },
      conditions: {},
      wounds: { value: 5, max: 10, critical: 0 },
      characteristics: {
        t:   { total: t,  value: t,  bonus: Math.floor(t / 10) },
        wp:  { total: wp, value: wp, bonus: Math.floor(wp / 10) },
        int: { total: 40, value: 40, bonus: 4 }
      },
      skills: { medicae: { total: medicae } }
    },
    update: async data => { updates.push(data); applyPaths(a, data); return data; },
    getFlag: (ns, key) => flags[`${ns}.${key}`],
    setFlag: async (ns, key, value) => { flags[`${ns}.${key}`] = value; return value; }
  };
  return a;
}

function disease(id, { active = true, cure = "Постельный режим." } = {}) {
  return { id, type: "disease", name: "Лёгочная чума", system: { active, cure } };
}

beforeEach(resetCaptured);
beforeEach(() => { game.time = { worldTime: 1_000_000 }; });

describe("comaWakeRemaining: чистый расчёт таймера", () => {
  it("нет флага — доступно сразу", () => {
    expect(comaWakeRemaining(null, 1000, 4)).toBe(0);
  });
  it("интервал ещё не истёк", () => {
    // 10 - T.b(4) = 6 суток = 518400 сек.
    expect(comaWakeRemaining(1000, 1000 + 100, 4)).toBe(518400 - 100);
  });
  it("интервал истёк — 0, не отрицательное", () => {
    expect(comaWakeRemaining(1000, 1000 + 999999, 4)).toBe(0);
  });
  it("T.b >= 10 — тест всегда доступен", () => {
    expect(comaWakeRemaining(1000, 1001, 10)).toBe(0);
  });
});

describe("applyHealing: cauterize (Прижигание)", () => {
  it("зафиксированный пациент — без теста W, урон минус T.b, Усталость через addFatigue", async () => {
    const medic = person();
    const patient = person({ t: 40 }); // T.b = 4
    captured.dice = [3, 8]; // 1d5 Усталости, 1d10 урон

    await applyHealing(medic, patient, { mode: "cauterize", restrained: true, mod: 0 });

    expect(patient.system.fatigue.value).toBe(3);
    expect(patient.system.wounds.value).toBe(1); // 5 - (8-4)
    expect(captured.rolls).toEqual(["1d5", "1d10"]); // тест W не бросался
    expect(captured.chat[0].content).not.toContain("вырваться");
  });

  it("незафиксированный пациент — дополнительный тест W−20, без последствий в коде", async () => {
    const medic = person();
    const patient = person({ t: 40, wp: 30 }); // W = 30, W-20 = 10
    captured.dice = [2, 5, 20]; // Усталость, урон, бросок теста W

    await applyHealing(medic, patient, { mode: "cauterize", restrained: false, mod: 0 });

    expect(captured.rolls).toEqual(["1d5", "1d10", "1d100"]);
    expect(captured.chat[0].content).toContain("пытается вырваться");
  });
});

describe("applyHealing: amputate (Ампутация, Medicae−10)", () => {
  it("успех — конечность удалена, без Кровотечения и Гангрены", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    captured.nextRoll = 10; // eff = 40-10 = 30, 10<=30 успех

    await applyHealing(medic, patient, { mode: "amputate", mod: 0, limb: "arm" });

    expect(patient.system.conditions.lostArms).toBe(true);
    expect(patient.system.conditions.lostArmsCount).toBe(1);
    expect(patient.system.conditions.bleeding).toBeUndefined();
    expect(patient.system.conditions.gangrene).toBeUndefined();
  });

  it("провал — Кровотечение + провал обработки обрубка → шанс Гангрены", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    // eff везде 30: тест ампутации 90 (провал), обработка обрубка 90 (провал), Гангрена ≤80 → 50 (наступает)
    captured.dice = [90, 90, 50];

    await applyHealing(medic, patient, { mode: "amputate", mod: 0, limb: "leg" });

    expect(patient.system.conditions.lostLegs).toBe(true);
    expect(patient.system.conditions.lostLegsCount).toBe(1);
    expect(patient.system.conditions.bleeding).toBe(true);
    expect(patient.system.conditions.bleedingLevel).toBe(1);
    expect(patient.system.conditions.gangrene).toBe(true);
  });
});

describe("applyHealing: reattach (Пришивание конечности, Medicae−30)", () => {
  it("нет потерянной части — предупреждение, без брос­ков и обновлений", async () => {
    const medic = person();
    const patient = person();

    await applyHealing(medic, patient, { mode: "reattach", mod: 0, limb: "arm" });

    expect(captured.warnings.length).toBe(1);
    expect(patient.updates.length).toBe(0);
    expect(captured.chat.length).toBe(0);
  });

  it("успех — счётчик уменьшается, флаг снимается при нуле, показаны сутки восстановления", async () => {
    const medic = person({ medicae: 40 });
    const patient = person({ t: 40 }); // T.b = 4
    patient.system.conditions.lostArms = true;
    patient.system.conditions.lostArmsCount = 1;
    captured.dice = [10, 6]; // тест (eff 40-30=10, успех), 1d10 суток = 6

    await applyHealing(medic, patient, { mode: "reattach", mod: 0, limb: "arm" });

    expect(patient.system.conditions.lostArmsCount).toBe(0);
    expect(patient.system.conditions.lostArms).toBe(false);
    expect(captured.chat[0].content).toContain("5"); // 6+3-4=5 суток
  });

  it("провал — счётчик не меняется, конечность потеряна безвозвратно", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    patient.system.conditions.lostArms = true;
    patient.system.conditions.lostArmsCount = 1;
    captured.nextRoll = 90; // eff 10, провал

    await applyHealing(medic, patient, { mode: "reattach", mod: 0, limb: "arm" });

    expect(patient.system.conditions.lostArmsCount).toBe(1);
    expect(patient.updates.length).toBe(0);
    expect(captured.chat[0].content).toContain("умирает");
  });
});

describe("applyHealing: coma (Кома, Medicae−40, раз в 10−T.b дней)", () => {
  it("интервал не истёк — предупреждение, тест не бросается", async () => {
    const medic = person();
    const patient = person({ t: 40 }); // T.b=4 → интервал 6 суток
    await patient.setFlag("warhammer-dbc", "comaTestAt", game.time.worldTime - 100);

    await applyHealing(medic, patient, { mode: "coma", mod: 0 });

    expect(captured.warnings.length).toBe(1);
    expect(captured.rolls.length).toBe(0);
  });

  it("интервал истёк — тест проходит, таймер сбрасывается в любом исходе", async () => {
    const medic = person({ medicae: 40 });
    const patient = person({ t: 40 });
    await patient.setFlag("warhammer-dbc", "comaTestAt", game.time.worldTime - 999_999_999);
    captured.nextRoll = 90; // eff = 40-40 = 0, провал

    await applyHealing(medic, patient, { mode: "coma", mod: 0 });

    expect(captured.rolls).toEqual(["1d100"]);
    expect(patient.getFlag("warhammer-dbc", "comaTestAt")).toBe(game.time.worldTime);
    expect(captured.chat[0].content).toContain("Провал");
  });
});

describe("applyHealing: мод. Талантов ПАЦИЕНТА к тесту Лечения (wdbc-uez7, делегированный тест)", () => {
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
  });

  it("Талант пациента с target:'skill:medicae:recipient' поднимает порог доктора и подписан как «пациент»", async () => {
    registerRuleSource("test-patient-mod", () => [
      { id: "pain-tol", label: "Высокий болевой порог",
        effects: [{ kind: "rollBonus", target: "skill:medicae:recipient", value: 10 }] }
    ]);
    const medic = person({ medicae: 40 });
    const patient = person({ t: 40 });
    captured.nextRoll = 10; // eff = 40(медик) + 10(мод. пациента) - 40(кома) = 10

    await applyHealing(medic, patient, { mode: "coma", mod: 0 });

    expect(captured.chat[0].content).toContain("порог <b>10</b>");
    expect(captured.chat[0].content).toContain("Высокий болевой порог");
    expect(captured.chat[0].content).toContain("(пациент)");
  });

  it("тот же Талант БЕЗ суффикса :recipient (свои тесты пациента) не подмешивается в тест доктора", () => {
    registerRuleSource("test-patient-mod", () => [
      { id: "self-only", label: "Своя Медика",
        effects: [{ kind: "rollBonus", target: "skill:medicae", value: 10 }] }
    ]);
    const medic = person({ medicae: 40 });
    const patient = person({ t: 40 });
    captured.nextRoll = 10; // без подмешивания eff = 40 - 40 = 0 → 10 > 0 провал

    return applyHealing(medic, patient, { mode: "coma", mod: 0 }).then(() => {
      expect(captured.chat[0].content).toContain("порог <b>0</b>");
      expect(captured.chat[0].content).toContain("Провал");
    });
  });
});

describe("applyHealing: disease (Лечение болезней)", () => {
  it("модификатор ухода складывается с Медикой, текст лечения болезни попадает в чат", async () => {
    const medic = person({ medicae: 40 });
    const d = disease("dis-1");
    const patient = person({ items: [d] });
    captured.nextRoll = 15; // eff = 40 - 20(rest) + 0 = 20, успех

    await applyHealing(medic, patient, { mode: "disease", mod: 0, diseaseCare: "rest", diseaseId: "dis-1" });

    expect(captured.chat[0].content).toContain("Лёгочная чума");
    expect(captured.chat[0].content).toContain("Постельный режим");
    expect(captured.chat[0].content).toContain("Успех");
  });
});
