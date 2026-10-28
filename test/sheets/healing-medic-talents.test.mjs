// 3-dc87: Таланты Медика в диалоге Лечения — Полевой Хирург, Радикальное
// Лечение, Быстрые Стежки, Перешивание, Консилиум (sheets/tabs/healing.mjs).
// Фикстура медика/пациента — как в healing.test.mjs (форма настоящих
// характеристик: total/bonus, поля value нет).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { applyHealing, resolveBionicTest } from "../../module/sheets/tabs/healing.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();

function applyPaths(target, data) {
  for (const [path, value] of Object.entries(data)) {
    const parts = path.split(".");
    let cur = target;
    for (const part of parts.slice(0, -1)) { cur[part] ??= {}; cur = cur[part]; }
    cur[parts.at(-1)] = value;
  }
}

function person({ fatigue = 0, t = 40, medicae = 40, int = 40 } = {}) {
  const updates = [];
  const flags = {};
  const list = [];
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = {
    name: "Подставной", updates, items: list,
    system: {
      fatigue: { value: fatigue }, conditions: {}, charDamage: {},
      wounds: { value: 5, max: 10, critical: 0 },
      characteristics: {
        t: { total: t, bonus: Math.floor(t / 10) },
        wp: { total: 30, bonus: 3 },
        int: { total: int, bonus: Math.floor(int / 10) }
      },
      skills: { medicae: { total: medicae } }
    },
    update: async data => { updates.push(data); applyPaths(a, data); return data; },
    getFlag: (ns, key) => flags[`${ns}.${key}`],
    setFlag: async (ns, key, value) => { flags[`${ns}.${key}`] = value; return value; }
  };
  return a;
}

const grant = (...keys) => {
  clearRuleSources();
  registerRuleSource("test", () => keys.map((f, i) =>
    ({ id: `test.medic${i}`, when: {}, effects: [{ kind: "grantFlag", target: f }] })));
};

beforeEach(resetCaptured);
beforeEach(() => { game.time = { worldTime: 1_000_000 }; });
afterEach(() => {
  captured.dice = null;
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

describe("Полевой Хирург: операции без стационара", () => {
  const gangrenous = () => { const p = person(); p.system.conditions = { gangrene: true }; return p; };

  it("Гангрена без операционной и без Таланта — отказ, бросков нет", async () => {
    const patient = gangrenous();
    await applyHealing(person(), patient, { mode: "gangreneSurgery", mod: 0, limb: "leg", theatre: false });
    expect(captured.rolls).toHaveLength(0);
    expect(patient.system.conditions.gangrene).toBe(true);
  });

  it("с Талантом — операция идёт в поле: порог 40−30−20=-10 → провал даже на 5; со стационаром 10 → успех", async () => {
    grant("medic.core.fieldSurgeon");
    const field = gangrenous();
    captured.nextRoll = 5;
    await applyHealing(person({ medicae: 40 }), field, { mode: "gangreneSurgery", mod: 0, limb: "leg", theatre: false });
    expect(captured.rolls).toHaveLength(1);
    expect(field.system.conditions.gangrene).toBe(true);
    expect(captured.chat[0].content).toContain("Полевой Хирург");

    resetCaptured();
    const indoors = gangrenous();
    captured.nextRoll = 5;
    await applyHealing(person({ medicae: 40 }), indoors, { mode: "gangreneSurgery", mod: 0, limb: "leg", theatre: true });
    expect(indoors.system.conditions.gangrene).toBe(false);
    expect(captured.chat[0].content).not.toContain("Полевой Хирург");
  });

  const armLost = () => {
    const p = person();
    p.system.lostLimbs = { rightArm: { lost: true, gangreneAt: 0 } };
    return p;
  };

  it("Пришивание без операционной и без Таланта — отказ, бросков нет, конечность не тронута", async () => {
    const patient = armLost();
    await applyHealing(person({ medicae: 60 }), patient, { mode: "reattach", mod: 0, limb: "arm", theatre: false });
    expect(captured.rolls).toHaveLength(0);
    expect(captured.warnings).toHaveLength(1);
    expect(patient.system.lostLimbs.rightArm.lost).toBe(true);
  });

  it("Пришивание в поле с Талантом: порог 60−30−20=10, в карточке «Полевой Хирург»", async () => {
    grant("medic.core.fieldSurgeon");
    const patient = armLost();
    captured.dice = [10, 5]; // 10 ≤ 10 — успех
    await applyHealing(person({ medicae: 60 }), patient, { mode: "reattach", mod: 0, limb: "arm", theatre: false });
    expect(captured.chat[0].content).toContain("порог <b>10</b>");
    expect(captured.chat[0].content).toContain("Полевой Хирург");
    expect(patient.system.lostLimbs.rightArm.lost).toBe(false);
  });

  it("Пришивание в операционной: порог 60−30=30, Талант ни при чём", async () => {
    grant("medic.core.fieldSurgeon");
    const patient = armLost();
    captured.dice = [30, 5];
    await applyHealing(person({ medicae: 60 }), patient, { mode: "reattach", mod: 0, limb: "arm", theatre: true });
    expect(captured.chat[0].content).toContain("порог <b>30</b>");
    expect(captured.chat[0].content).not.toContain("Полевой Хирург");
  });

  it("Бионика без операционной и без Таланта — отказ до броска; с Талантом в поле — порог −20", async () => {
    const patient = armLost();
    await resolveBionicTest(person({ medicae: 60 }), patient, { mod: 0, limb: "arm", theatre: false });
    expect(captured.rolls).toHaveLength(0);
    expect(captured.warnings).toHaveLength(1);

    resetCaptured();
    grant("medic.core.fieldSurgeon");
    captured.dice = [10, 5];
    await resolveBionicTest(person({ medicae: 60 }), patient, { mod: 0, limb: "arm", theatre: false });
    expect(captured.chat[0].content).toContain("порог <b>10</b>");
    expect(captured.chat[0].content).toContain("Полевой Хирург");
  });
});

describe("Радикальное Лечение и Быстрые Стежки в Первой Помощи", () => {
  const wounded = (value = 5) => { const p = person(); p.system.wounds = { value, max: 10, critical: 0 }; return p; };

  it("−20 к тесту → +2 Раны при Успехе", async () => {
    grant("medic.core.radicalTreatment");
    const patient = wounded(1); // потеряно 9 > T.b×2=8 → Тяжёлое: Medicae+0, база 2
    patient.system.wounds = { value: 1, max: 20, critical: 0 };
    captured.nextRoll = 15; // 40 −20 = 20
    await applyHealing(person({ medicae: 40 }), patient, { mode: "firstAid", mod: 0, bonus: 0, radical: 2 });
    expect(captured.chat[0].content).toContain("порог <b>20</b>");
    expect(patient.system.wounds.value).toBe(1 + 2 + 2);
  });

  it("провал теста — дополнительных Ран нет", async () => {
    grant("medic.core.radicalTreatment");
    const patient = wounded(5);
    captured.nextRoll = 99;
    await applyHealing(person(), patient, { mode: "firstAid", mod: 0, bonus: 0, radical: 3 });
    expect(patient.system.wounds.value).toBe(5);
  });

  it("без Таланта выпадающий список игнорируется", async () => {
    const patient = wounded(5);
    captured.nextRoll = 1;
    await applyHealing(person(), patient, { mode: "firstAid", mod: 0, bonus: 0, radical: 3 });
    expect(captured.chat[0].content).toContain("порог <b>50</b>"); // 40+10 (Лёгкое), без −30
    expect(captured.chat[0].content).not.toContain("Радикальное");
  });

  it("Быстрые Стежки: I.b 4 → 2 — Лёгкое лечит на 2 вместо 4", async () => {
    grant("medic.core.fastStitches");
    const slow = wounded(5);
    captured.nextRoll = 1;
    await applyHealing(person({ int: 40 }), slow, { mode: "firstAid", mod: 0, bonus: 0, fastStitches: false });
    expect(slow.system.wounds.value).toBe(9);

    resetCaptured();
    const fast = wounded(5);
    captured.nextRoll = 1;
    await applyHealing(person({ int: 40 }), fast, { mode: "firstAid", mod: 0, bonus: 0, fastStitches: true });
    expect(fast.system.wounds.value).toBe(7);
  });
});

describe("Перешивание: повтор Первой Помощи", () => {
  const fresh = () => { const p = person(); p.system.wounds = { value: 5, max: 10, critical: 0 }; return p; };

  it("провал записывает метку, повтор в пределах I.b минут разрешён", async () => {
    grant("medic.core.restitching");
    const medic = person({ int: 40 }); // I.b = 4 мин
    const patient = fresh();
    captured.nextRoll = 99;
    await applyHealing(medic, patient, { mode: "firstAid", mod: 0, bonus: 0 });
    expect(patient.system.wounds.firstAidUsed).toBe(true);
    expect(patient.system.wounds.firstAidFailed).toBe(true);
    expect(patient.system.wounds.firstAidAt).toBe(1_000_000);

    game.time = { worldTime: 1_000_000 + 3 * 60 };
    resetCaptured();
    captured.nextRoll = 1;
    await applyHealing(medic, patient, { mode: "firstAid", mod: 0, bonus: 0 });
    expect(captured.chat[0].content).toContain("Перешивание");
    expect(patient.system.wounds.value).toBeGreaterThan(5);
    expect(patient.system.wounds.firstAidFailed).toBe(false);
  });

  it("провал не обнуляет предел «потеряно после прошлой помощи» — повтор не лечит сверх него (review 24.10.2026)", async () => {
    grant("medic.core.restitching");
    const medic = person({ int: 40 });
    const patient = fresh();
    patient.system.wounds.lostSinceFirstAid = 1;
    captured.nextRoll = 99;
    await applyHealing(medic, patient, { mode: "firstAid", mod: 0, bonus: 0 });
    expect(patient.system.wounds.lostSinceFirstAid).toBe(1);
    game.time = { worldTime: 1_000_000 + 60 };
    resetCaptured(); captured.nextRoll = 1;
    await applyHealing(medic, patient, { mode: "firstAid", mod: 0, bonus: 0 });
    expect(patient.system.wounds.value).toBe(5 + 1);
    expect(patient.system.wounds.lostSinceFirstAid).toBe(0);
  });

  it("позже I.b минут — отказ (мутация: граница по времени)", async () => {
    grant("medic.core.restitching");
    const medic = person({ int: 40 });
    const patient = fresh();
    captured.nextRoll = 99;
    await applyHealing(medic, patient, { mode: "firstAid", mod: 0, bonus: 0 });
    game.time = { worldTime: 1_000_000 + 5 * 60 };
    resetCaptured();
    captured.nextRoll = 1;
    await applyHealing(medic, patient, { mode: "firstAid", mod: 0, bonus: 0 });
    expect(captured.rolls).toHaveLength(0);
  });

  it("без Таланта повтор невозможен", async () => {
    const medic = person();
    const patient = fresh();
    captured.nextRoll = 99;
    await applyHealing(medic, patient, { mode: "firstAid", mod: 0, bonus: 0 });
    resetCaptured();
    captured.nextRoll = 1;
    await applyHealing(medic, patient, { mode: "firstAid", mod: 0, bonus: 0 });
    expect(captured.rolls).toHaveLength(0);
  });

  it("повтор разрешён и тому, кого провалил другой медик (метка — на пациенте)", async () => {
    grant("medic.core.restitching");
    const patient = fresh();
    captured.nextRoll = 99;
    await applyHealing(person({ int: 20 }), patient, { mode: "firstAid", mod: 0, bonus: 0 });
    resetCaptured();
    captured.nextRoll = 1;
    await applyHealing(person({ int: 40 }), patient, { mode: "firstAid", mod: 0, bonus: 0 });
    expect(captured.rolls).toHaveLength(1);
  });
});

describe("Консилиум: ассистенты теста лечения", () => {
  const wounded = () => { const p = person(); p.system.wounds = { value: 5, max: 20, critical: 0 }; return p; };

  it("без Таланта максимум 2: +20 к Порогу, лечение без прибавки", async () => {
    const patient = wounded(); // потеряно 15 > 8 → Тяжёлое (+0), база 2
    captured.nextRoll = 1;
    await applyHealing(person({ medicae: 40 }), patient, { mode: "firstAid", mod: 0, bonus: 0, assistants: 5 });
    expect(captured.chat[0].content).toContain("порог <b>60</b>");
    expect(patient.system.wounds.value).toBe(7);
  });

  it("с Консилиумом максимум 4: +40 к Порогу и +2 Раны за каждого (8)", async () => {
    grant("medic.core.councilium");
    const patient = wounded();
    captured.nextRoll = 1;
    await applyHealing(person({ medicae: 40 }), patient, { mode: "firstAid", mod: 0, bonus: 0, assistants: 9 });
    expect(captured.chat[0].content).toContain("порог <b>80</b>");
    expect(patient.system.wounds.value).toBe(5 + 2 + 8);
  });
});
