// test/sheets/healing.test.mjs
//
// wdbc-b82z: новые режимы Лечения (стр. 231-232) — Прижигание, Ампутация,
// Пришивание конечностей, Кома, Лечение болезней. Бионика/Кибернетика
// (открывает Хирургеон) не покрыта — заглушка Hooks.once не хранит колбэк.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { applyHealing, comaWakeRemaining, resolveBionicTest, stopBleedingMod, patientActedLastTurn } from "../../module/sheets/tabs/healing.mjs";
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
    // wdbc-x1nz.2.92: «уровень Кровотечения» книжного смысла не имеет — провал
    // накладывает Кровотечение, счётчик не трогает.
    expect(patient.system.conditions.bleedingLevel).toBeUndefined();
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

// wdbc-1rno.6 (стр. 30-31): «обрубок нуждается в мед. обработке, иначе через
// T.b дней с шансом 80% Гангрена» — не привязано к Ампутации, применимо к
// любому текущему lostX (напр. от крит-эффекта, module/combat/limb-loss.mjs).
describe("applyHealing: stumpCare (Обработка обрубка, Medicae−10)", () => {
  it("нет обрубка этой части тела — предупреждение, без обновлений", async () => {
    const medic = person();
    const patient = person();

    await applyHealing(medic, patient, { mode: "stumpCare", mod: 0, limb: "hand" });

    expect(captured.warnings.length).toBe(1);
    expect(patient.updates.length).toBe(0);
  });

  it("успех — снимает запланированный таймер Гангрены", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    patient.system.conditions.lostHands = true;
    patient.system.conditions.lostHandsCount = 1;
    patient.system.conditions.lostHandsGangreneAt = 500000;
    captured.nextRoll = 10; // eff 40-10=30, успех

    await applyHealing(medic, patient, { mode: "stumpCare", mod: 0, limb: "hand" });

    expect(patient.system.conditions.lostHandsGangreneAt).toBe(0);
    expect(captured.chat[0].content).toContain("угроза Гангрены снята");
  });

  it("провал — таймер не трогается", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    patient.system.conditions.lostLegs = true;
    patient.system.conditions.lostLegsCount = 1;
    patient.system.conditions.lostLegsGangreneAt = 500000;
    captured.nextRoll = 90; // eff 30, провал

    await applyHealing(medic, patient, { mode: "stumpCare", mod: 0, limb: "leg" });

    expect(patient.system.conditions.lostLegsGangreneAt).toBe(500000);
    expect(captured.chat[0].content).toContain("остаётся");
  });
});

// wdbc-1rno.6: успешная бионика раньше молча не восстанавливала lostX вовсе.
describe("resolveBionicTest: установка бионики (Medicae−30)", () => {
  it("успех, выбрана часть тела с реальной потерей — снимает lostX и таймер Гангрены", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    patient.system.conditions.lostEyes = true;
    patient.system.conditions.lostEyesCount = 1;
    patient.system.conditions.lostEyesGangreneAt = 500000;
    captured.dice = [10, 6]; // тест (eff 40-30=10, успех), 1d10 суток адаптации

    await resolveBionicTest(medic, patient, { mod: 0, limb: "eye" });

    expect(patient.system.conditions.lostEyesCount).toBe(0);
    expect(patient.system.conditions.lostEyes).toBe(false);
    expect(patient.system.conditions.lostEyesGangreneAt).toBe(0);
    expect(captured.chat[0].content).toContain("восстановлена бионикой");
  });

  it("успех, часть тела не выбрана — обычный имплант, Состояния не трогает", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    captured.dice = [10, 6];

    await resolveBionicTest(medic, patient, { mod: 0, limb: "" });

    expect(patient.updates.length).toBe(0);
    expect(captured.chat[0].content).not.toContain("восстановлена");
  });

  it("успех, выбрана часть тела, но она не потеряна — предупреждение в карточке, Состояния не трогает", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    captured.dice = [10, 6];

    await resolveBionicTest(medic, patient, { mod: 0, limb: "hand" });

    expect(patient.updates.length).toBe(0);
    expect(captured.chat[0].content).toContain("нет утраченной");
  });

  it("провал — непогл. урон + Калечение, как раньше (без изменений)", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    patient.system.conditions.lostArms = true;
    patient.system.conditions.lostArmsCount = 1;
    captured.dice = [90, 7]; // тест провал, 1d10 урона = 7

    await resolveBionicTest(medic, patient, { mod: 0, limb: "arm" });

    expect(patient.system.conditions.lostArmsCount).toBe(1); // не тронуто
    expect(patient.system.conditions.crippling).toBe(true);
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

// wdbc-x1nz.2.92 (книга, «Кровотечение»): «Кровотечение можно за полудействие
// убрать тестом Medicae −10, который становится −30, если пациент активно
// действовал в свой прошлый Ход, или для попытки остановить Кровотечение на
// себе. Используя жгут… полное действие, но бонус +40».
describe("applyHealing: stopBleeding (Остановить Кровотечение)", () => {
  it("модификатор книги: −10; −30 при активности/на себе (не сумма); жгут +40", () => {
    expect(stopBleedingMod({})).toBe(-10);
    expect(stopBleedingMod({ patientActive: true })).toBe(-30);
    expect(stopBleedingMod({ selfTreat: true, patientActive: true })).toBe(-30);
    expect(stopBleedingMod({ selfTreat: true, tourniquet: true })).toBe(10);
  });

  it("успех снимает Кровотечение, Обескровливание остаётся", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    patient.system.conditions = { bleeding: true, haemorrhaging: true, haemorrhagingLevel: 2 };
    captured.nextRoll = 25; // 40−10 = 30

    await applyHealing(medic, patient, { mode: "stopBleeding", mod: 0 });

    expect(patient.system.conditions.bleeding).toBe(false);
    expect(patient.system.conditions.haemorrhagingLevel).toBe(2);
    expect(captured.chat[0].content).toContain("порог <b>30</b>");
  });

  it("на себе — −30: тот же бросок 25 уже провал", async () => {
    const medic = person({ medicae: 40 });
    medic.system.conditions = { bleeding: true };
    captured.nextRoll = 25; // 40−30 = 10

    await applyHealing(medic, medic, { mode: "stopBleeding", mod: 0 });

    expect(medic.system.conditions.bleeding).toBe(true);
    expect(captured.chat[0].content).toContain("порог <b>10</b>");
  });

  it("жгут: +40", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    patient.system.conditions = { bleeding: true };
    captured.nextRoll = 60; // порог 40−30+40 = 50; исход здесь не важен
    await applyHealing(medic, patient, { mode: "stopBleeding", mod: 0, patientActive: true, tourniquet: true });
    expect(captured.chat[0].content).toContain("порог <b>50</b>");
  });

  it("нет Кровотечения — предупреждение, без броска", async () => {
    const medic = person();
    const patient = person();
    await applyHealing(medic, patient, { mode: "stopBleeding", mod: 0 });
    expect(captured.warnings.length).toBe(1);
    expect(captured.rolls).toHaveLength(0);
  });

  it("«активно действовал в прошлый Ход» — по меткам прошлого Хода пациента", async () => {
    const p = person();
    expect(patientActedLastTurn(p)).toBe(false);
    await p.setFlag("warhammer-dbc", "movedThisTurn", true);
    expect(patientActedLastTurn(p)).toBe(true);
  });
});

// wdbc-x1nz.2.96 (книга, «Гангрена»): «Лечение Гангрены требует сложной
// операции в хотя бы операционной комнате, занимающей смену работы и тест
// Medicae–30. Даже в случае Успеха персонаж теряет гангренозную конечность
// полностью».
describe("applyHealing: gangreneSurgery (Лечение Гангрены)", () => {
  function gangrenous(conds = {}) {
    const p = person();
    p.system.conditions = { gangrene: true, ...conds };
    return p;
  }

  it("без операционной — предупреждение, без броска", async () => {
    const patient = gangrenous();
    await applyHealing(person(), patient, { mode: "gangreneSurgery", mod: 0, limb: "arm", theatre: false });
    expect(captured.rolls).toHaveLength(0);
    expect(patient.system.conditions.gangrene).toBe(true);
  });

  it("успех, часть тела цела — Гангрена снята, +1 к её потере", async () => {
    const patient = gangrenous();
    captured.nextRoll = 5; // 40−30 = 10
    await applyHealing(person({ medicae: 40 }), patient, { mode: "gangreneSurgery", mod: 0, limb: "leg", theatre: true });
    expect(patient.system.conditions.gangrene).toBe(false);
    expect(patient.system.conditions.lostLegsCount).toBe(1);
  });

  it("успех, Гангрена обрубка кисти — теряется вся рука", async () => {
    const patient = gangrenous({ lostHands: true, lostHandsCount: 1 });
    captured.nextRoll = 5;
    await applyHealing(person({ medicae: 40 }), patient, { mode: "gangreneSurgery", mod: 0, limb: "hand", theatre: true });
    expect(patient.system.conditions.lostHandsCount).toBe(0);
    expect(patient.system.conditions.lostArmsCount).toBe(1);
  });

  it("провал — Гангрена остаётся, конечность цела", async () => {
    const patient = gangrenous();
    captured.nextRoll = 90;
    await applyHealing(person({ medicae: 40 }), patient, { mode: "gangreneSurgery", mod: 0, limb: "leg", theatre: true });
    expect(patient.system.conditions.gangrene).toBe(true);
    expect(patient.system.conditions.lostLegsCount).toBeUndefined();
  });
});
