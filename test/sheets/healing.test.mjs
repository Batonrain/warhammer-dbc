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
      charDamage: {},
      wounds: { value: 5, max: 10, critical: 0 },
      characteristics: {
        // Форма настоящих характеристик: total/bonus, поля value НЕТ —
        // фикстура с value прятала баг T-теста (wdbc-x1nz.2.103).
        t:   { total: t,  bonus: Math.floor(t / 10) },
        wp:  { total: wp, bonus: Math.floor(wp / 10) },
        int: { total: 40, bonus: 4 }
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
  it("зафиксированный пациент — без теста W, 1d10 урона в Характеристику T (не Раны), Усталость через addFatigue", async () => {
    const medic = person();
    const patient = person({ t: 40 });
    captured.dice = [3, 8]; // 1d5 Усталости, 1d10 урон

    await applyHealing(medic, patient, { mode: "cauterize", restrained: true, mod: 0 });

    expect(patient.system.fatigue.value).toBe(3);
    expect(patient.system.charLoss.t).toBe(8); // урон в T — charLoss (wdbc-x1nz.2.83)
    expect(patient.system.wounds.value).toBe(5); // Раны не тронуты
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

describe("applyHealing: cauterize — Кровотечение и обрубок (wdbc-x1nz.2.103)", () => {
  it("снимает Кровотечение и единственный таймер Гангрены обрубка", async () => {
    const patient = person();
    patient.system.conditions.bleeding = true;
    patient.system.lostLimbs = { rightHand: { lost: true, gangreneAt: 500000 } };
    captured.dice = [1, 1];

    await applyHealing(person(), patient, { mode: "cauterize", restrained: true, mod: 0 });

    expect(patient.system.conditions.bleeding).toBe(false);
    expect(patient.system.lostLimbs.rightHand.gangreneAt).toBe(0);
    expect(captured.chat[0].content).toContain("прижжён");
  });

  it("два необработанных обрубка без выбора — ни один не трогается, подсказка в чате", async () => {
    const patient = person();
    patient.system.lostLimbs = { rightHand: { lost: true, gangreneAt: 500000 }, leftLeg: { lost: true, gangreneAt: 600000 } };
    captured.dice = [1, 1];

    await applyHealing(person(), patient, { mode: "cauterize", restrained: true, mod: 0 });

    expect(patient.system.lostLimbs.rightHand.gangreneAt).toBe(500000);
    expect(patient.system.lostLimbs.leftLeg.gangreneAt).toBe(600000);
    expect(captured.chat[0].content).toContain("несколько");
  });

  it("выбранная часть тела — прижигается именно она", async () => {
    const patient = person();
    patient.system.lostLimbs = { rightHand: { lost: true, gangreneAt: 500000 }, leftLeg: { lost: true, gangreneAt: 600000 } };
    captured.dice = [1, 1];

    await applyHealing(person(), patient, { mode: "cauterize", restrained: true, mod: 0, limb: "leg" });

    expect(patient.system.lostLimbs.leftLeg.gangreneAt).toBe(0);
    expect(patient.system.lostLimbs.rightHand.gangreneAt).toBe(500000);
  });
});

describe("applyHealing: amputate (Ампутация, Medicae−10)", () => {
  it("успех — конечность удалена, без Кровотечения и Гангрены", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    captured.nextRoll = 10; // eff = 40-10 = 30, 10<=30 успех

    await applyHealing(medic, patient, { mode: "amputate", mod: 0, limb: "arm" });

    // wdbc-x1nz.2.100: потеря хранится по сторонам — первая целая (правая).
    expect(patient.system.lostLimbs.rightArm.lost).toBe(true);
    expect(patient.system.conditions.bleeding).toBeUndefined();
    expect(patient.system.conditions.gangrene).toBeUndefined();
  });

  // wdbc-x1nz.2.100: bodySide в опциях диалога выбирает КОНКРЕТНУЮ сторону,
  // не всегда «первую целую».
  it("bodySide:'left' ампутирует левую руку, не правую", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    captured.nextRoll = 10;

    await applyHealing(medic, patient, { mode: "amputate", mod: 0, limb: "arm", bodySide: "left" });

    expect(patient.system.lostLimbs.leftArm.lost).toBe(true);
    expect(patient.system.lostLimbs.rightArm?.lost).not.toBe(true);
  });

  // wdbc-x1nz.2.103: обработка обрубка и 80% Гангрены — не сразу, а таймером
  // обрубка (T.b дней), как у потери от крит-эффекта.
  it("провал — Кровотечение + таймер Гангрены обрубка, Гангрены сразу нет", async () => {
    const medic = person({ medicae: 40 });
    const patient = person(); // T.b 4
    captured.dice = [90];

    await applyHealing(medic, patient, { mode: "amputate", mod: 0, limb: "leg" });

    expect(captured.rolls).toEqual(["1d100"]);
    expect(patient.system.lostLimbs.rightLeg.lost).toBe(true);
    expect(patient.system.lostLimbs.rightLeg.gangreneAt).toBe(1_000_000 + 4 * 86400);
    expect(patient.system.conditions.bleeding).toBe(true);
    // wdbc-x1nz.2.92: «уровень Кровотечения» книжного смысла не имеет.
    expect(patient.system.conditions.bleedingLevel).toBeUndefined();
    expect(patient.system.conditions.gangrene).toBeUndefined();
  });

  it("успех — таймера обрубка нет", async () => {
    const patient = person();
    captured.nextRoll = 10;
    await applyHealing(person({ medicae: 40 }), patient, { mode: "amputate", mod: 0, limb: "leg" });
    expect(patient.system.lostLimbs.rightLeg.gangreneAt).toBe(0);
  });

  it("отрубить клинком — без теста, как провал; оружие E — без Кровотечения", async () => {
    const a = person();
    await applyHealing(person(), a, { mode: "amputate", mod: 0, limb: "leg", chop: true });
    expect(captured.rolls).toEqual([]);
    expect(a.system.conditions.bleeding).toBe(true);
    expect(a.system.lostLimbs.rightLeg.gangreneAt).toBeGreaterThan(0);

    const b = person();
    await applyHealing(person(), b, { mode: "amputate", mod: 0, limb: "leg", chop: true, chopEnergy: true });
    expect(b.system.conditions.bleeding).toBeUndefined();
    expect(b.system.lostLimbs.rightLeg.gangreneAt).toBeGreaterThan(0);
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
    patient.system.lostLimbs = { rightArm: { lost: true, gangreneAt: 0 } };
    captured.dice = [10, 6]; // тест (eff 40-30=10, успех), 1d10 суток = 6

    await applyHealing(medic, patient, { mode: "reattach", mod: 0, limb: "arm" });

    expect(patient.system.lostLimbs.rightArm.lost).toBe(false);
    expect(captured.chat[0].content).toContain("5"); // 6+3-4=5 суток
    // wdbc-x1nz.2.106: рука бесполезна эти 5 суток, снимется по Календарю.
    expect(patient.system.uselessLimbs.rightArm.state).toBe("splinted");
    expect(patient.system.uselessLimbs.rightArm.healAt).toBe(1_000_000 + 5 * 86400);
  });

  it("пришитая кисть — бесполезна вся рука на срок восстановления; глаз — без бесполезности", async () => {
    const hand = person({ t: 40 });
    hand.system.lostLimbs = { leftHand: { lost: true, gangreneAt: 0 } };
    captured.dice = [10, 1]; // 1+3-4=0 → мин. 1 сутки
    await applyHealing(person({ medicae: 40 }), hand, { mode: "reattach", mod: 0, limb: "hand" });
    expect(hand.system.uselessLimbs.leftArm.healAt).toBe(1_000_000 + 86400);

    const eye = person({ t: 40 });
    eye.system.lostLimbs = { rightEye: { lost: true, gangreneAt: 0 } };
    captured.dice = [10, 6];
    await applyHealing(person({ medicae: 40 }), eye, { mode: "reattach", mod: 0, limb: "eye" });
    expect(eye.system.uselessLimbs).toBeUndefined();
  });

  it("провал — сторона не меняется, конечность потеряна безвозвратно", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    patient.system.lostLimbs = { rightArm: { lost: true, gangreneAt: 0 } };
    captured.nextRoll = 90; // eff 10, провал

    await applyHealing(medic, patient, { mode: "reattach", mod: 0, limb: "arm" });

    expect(patient.system.lostLimbs.rightArm.lost).toBe(true);
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
    patient.system.lostLimbs = { rightHand: { lost: true, gangreneAt: 500000 } };
    captured.nextRoll = 10; // eff 40-10=30, успех

    await applyHealing(medic, patient, { mode: "stumpCare", mod: 0, limb: "hand" });

    expect(patient.system.lostLimbs.rightHand.gangreneAt).toBe(0);
    expect(captured.chat[0].content).toContain("угроза Гангрены снята");
  });

  it("провал — таймер не трогается", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    patient.system.lostLimbs = { rightLeg: { lost: true, gangreneAt: 500000 } };
    captured.nextRoll = 90; // eff 30, провал

    await applyHealing(medic, patient, { mode: "stumpCare", mod: 0, limb: "leg" });

    expect(patient.system.lostLimbs.rightLeg.gangreneAt).toBe(500000);
    expect(captured.chat[0].content).toContain("остаётся");
  });
});

// wdbc-1rno.6: успешная бионика раньше молча не восстанавливала lostX вовсе.
describe("resolveBionicTest: потеряно мутацией Потеря Конечности — только Best.Q (wdbc-1rno.6.1)", () => {
  it("имплант ниже Best.Q — конечность не восстанавливается", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    patient.system.lostLimbs = { leftArm: { lost: true, gangreneAt: 0, mutation: true } };
    captured.dice = [10, 6];

    await resolveBionicTest(medic, patient, { mod: 0, limb: "arm", bodySide: "left", implantQuality: "lower" });

    expect(patient.system.lostLimbs.leftArm.lost).toBe(true);
    expect(captured.chat[0].content).toContain("только Best.Q");
  });

  it("Best.Q — восстанавливается, пометка мутации снята", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    patient.system.lostLimbs = { leftArm: { lost: true, gangreneAt: 0, mutation: true } };
    captured.dice = [10, 6];

    await resolveBionicTest(medic, patient, { mod: 0, limb: "arm", bodySide: "left", implantQuality: "best" });

    expect(patient.system.lostLimbs.leftArm.lost).toBe(false);
    expect(patient.system.lostLimbs.leftArm.mutation).toBe(false);
  });
});

describe("resolveBionicTest: установка бионики (Medicae−30)", () => {
  it("успех, выбрана часть тела с реальной потерей — снимает lostX и таймер Гангрены", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    patient.system.lostLimbs = { rightEye: { lost: true, gangreneAt: 500000 } };
    captured.dice = [10, 6]; // тест (eff 40-30=10, успех), 1d10 суток адаптации

    await resolveBionicTest(medic, patient, { mod: 0, limb: "eye" });

    expect(patient.system.lostLimbs.rightEye.lost).toBe(false);
    expect(patient.system.lostLimbs.rightEye.gangreneAt).toBe(0);
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

  it("провал — только непогл. урон, Калечения в книге нет (wdbc-x1nz.2.103)", async () => {
    const medic = person({ medicae: 40 });
    const patient = person();
    patient.system.conditions.lostArms = true;
    patient.system.conditions.lostArmsCount = 1;
    captured.dice = [90, 7]; // тест провал, 1d10 урона = 7

    await resolveBionicTest(medic, patient, { mod: 0, limb: "arm" });

    expect(patient.system.conditions.lostArmsCount).toBe(1); // не тронуто
    expect(patient.system.conditions.crippling).toBeUndefined();
    expect(patient.system.wounds.value).toBe(0); // 5 − 7 → 0, 2 в Критические
    expect(patient.system.wounds.critical).toBe(2);
  });
});

describe("applyHealing: coma (Кома, Medicae−40, раз в 10−T.b дней)", () => {
  it("интервал не истёк — предупреждение, тест не бросается", async () => {
    const medic = person();
    const patient = person({ t: 40 }); // T.b=4 → интервал 6 суток
    patient.system.conditions.coma = true;
    await patient.setFlag("warhammer-dbc", "comaTestAt", game.time.worldTime - 100);

    await applyHealing(medic, patient, { mode: "coma", mod: 0 });

    expect(captured.warnings.length).toBe(1);
    expect(captured.rolls.length).toBe(0);
  });

  it("интервал истёк — тест проходит, таймер сбрасывается в любом исходе", async () => {
    const medic = person({ medicae: 40 });
    const patient = person({ t: 40 });
    patient.system.conditions.coma = true;
    await patient.setFlag("warhammer-dbc", "comaTestAt", game.time.worldTime - 999_999_999);
    captured.nextRoll = 90; // eff = 40-40 = 0, провал

    await applyHealing(medic, patient, { mode: "coma", mod: 0 });

    expect(captured.rolls).toEqual(["1d100"]);
    expect(patient.getFlag("warhammer-dbc", "comaTestAt")).toBe(game.time.worldTime);
    expect(captured.chat[0].content).toContain("Провал");
    expect(patient.system.conditions.coma).toBe(true);
  });

  // wdbc-x1nz.2.105: Кома — Состояние, Успех его снимает.
  it("Успех снимает Кому", async () => {
    const patient = person({ t: 40 });
    patient.system.conditions.coma = true;
    captured.nextRoll = 5; // eff = 50-40 = 10
    await applyHealing(person({ medicae: 50 }), patient, { mode: "coma", mod: 0 });
    expect(patient.system.conditions.coma).toBe(false);
  });

  it("пациент не в коме — предупреждение, без броска", async () => {
    await applyHealing(person(), person(), { mode: "coma", mod: 0 });
    expect(captured.warnings.length).toBe(1);
    expect(captured.rolls.length).toBe(0);
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
    patient.system.conditions.coma = true;
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
    patient.system.conditions.coma = true;
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

  it("успех, часть тела цела — Гангрена снята, +1 к её потере (на первой целой стороне)", async () => {
    const patient = gangrenous();
    captured.nextRoll = 5; // 40−30 = 10
    await applyHealing(person({ medicae: 40 }), patient, { mode: "gangreneSurgery", mod: 0, limb: "leg", theatre: true });
    expect(patient.system.conditions.gangrene).toBe(false);
    expect(patient.system.lostLimbs.rightLeg.lost).toBe(true);
  });

  it("успех, Гангрена обрубка кисти — теряется вся рука (та же сторона)", async () => {
    const patient = gangrenous();
    patient.system.lostLimbs = { rightHand: { lost: true, gangreneAt: 1 } };
    captured.nextRoll = 5;
    await applyHealing(person({ medicae: 40 }), patient, { mode: "gangreneSurgery", mod: 0, limb: "hand", theatre: true });
    expect(patient.system.lostLimbs.rightHand.lost).toBe(false);
    expect(patient.system.lostLimbs.rightArm.lost).toBe(true);
  });

  it("провал — Гангрена остаётся, конечность цела", async () => {
    const patient = gangrenous();
    captured.nextRoll = 90;
    await applyHealing(person({ medicae: 40 }), patient, { mode: "gangreneSurgery", mod: 0, limb: "leg", theatre: true });
    expect(patient.system.conditions.gangrene).toBe(true);
    expect(patient.system.lostLimbs?.rightLeg?.lost).not.toBe(true);
  });
});

describe("Первая Помощь и отдых по книге (wdbc-x1nz.2.103)", () => {
  it("Пассивное, Тяжёлое — тест T+0 по Итогу T (раньше порог был 0)", async () => {
    const patient = person({ t: 40 });
    patient.system.wounds = { value: 1, max: 12, critical: 0 }; // потеряно 11 > T.b×2 = 8
    captured.nextRoll = 35;

    await applyHealing(person(), patient, { mode: "passive", mod: 0, bonus: 0 });

    expect(captured.chat[0].content).toContain("порог <b>40</b>");
    expect(patient.system.wounds.value).toBe(2);
  });

  it("не лечит больше, чем потеряно после прошлой Первой Помощи; обнуляет счётчик", async () => {
    const medic = person(); // I.b 4
    const patient = person();
    patient.system.wounds = { value: 5, max: 10, critical: 0, lostSinceFirstAid: 2 };
    captured.nextRoll = 5;

    await applyHealing(medic, patient, { mode: "firstAid", mod: 0, bonus: 0 });

    expect(patient.system.wounds.value).toBe(7);
    expect(patient.system.wounds.lostSinceFirstAid).toBe(0);
    expect(captured.chat[0].content).toContain("Ограничено");
  });

  it("помощь ещё не оказывали (null) — предел только нехватка", async () => {
    const patient = person();
    patient.system.wounds = { value: 5, max: 10, critical: 0, lostSinceFirstAid: null };
    captured.nextRoll = 5;
    await applyHealing(person(), patient, { mode: "firstAid", mod: 0, bonus: 0 });
    expect(patient.system.wounds.value).toBe(9);
  });

  it("Саркофаг: лечение не поднимает Раны выше effectiveMax", async () => {
    const patient = person();
    patient.system.wounds = { value: 3, max: 10, effectiveMax: 5, critical: 0 };
    captured.nextRoll = 5;
    await applyHealing(person(), patient, { mode: "firstAid", mod: 0, bonus: 0 });
    expect(patient.system.wounds.value).toBe(5);
  });
});
