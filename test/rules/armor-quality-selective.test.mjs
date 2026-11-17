// test/rules/armor-quality-selective.test.mjs
//
// Качество брони (core, стр. 165, «Редкость и Качество → Броня»):
//   Good.Q — −10 на Избирательные атаки по сочленениям и визорам носителя;
//   Best.Q — то же + «+2 AP в сочленениях и визорах после уменьшения».
// Раньше это было только строкой-напоминанием в карточке.

import { describe, it, expect } from "vitest";
import { armorQualitySelectivePenalty } from "../../module/constants/quality.mjs";
import {
  resolveArmorAbsorptionAP, mergeArmorLocFlags, emptyArmorLocFlags
} from "../../module/combat/armor-properties.mjs";

const armor = (quality, extra = {}) => ({
  type: "armor", system: { equipped: true, quality, ...extra }
});

describe("штраф атакующему по сочленению/визору (Good.Q / Best.Q носителя)", () => {
  it("Good.Q и Best.Q — −10", () => {
    expect(armorQualitySelectivePenalty([armor("good")])).toBe(-10);
    expect(armorQualitySelectivePenalty([armor("best")])).toBe(-10);
  });
  it("Poor.Q и Comm.Q — без штрафа", () => {
    expect(armorQualitySelectivePenalty([armor("poor")])).toBe(0);
    expect(armorQualitySelectivePenalty([armor("common")])).toBe(0);
  });
  it("не надетая броня не считается", () => {
    expect(armorQualitySelectivePenalty([armor("best", { equipped: false })])).toBe(0);
  });
  it("не складывается: две хорошие брони — всё равно −10", () => {
    expect(armorQualitySelectivePenalty([armor("good"), armor("best")])).toBe(-10);
  });
  it("друкхарийская броня идёт по своей таблице — штрафа нет", () => {
    expect(armorQualitySelectivePenalty([armor("best", { drukhari: true })])).toBe(0);
  });
  it("предметы не-брони игнорируются", () => {
    expect(armorQualitySelectivePenalty([{ type: "gear", system: { equipped: true, quality: "best" } }])).toBe(0);
  });
});

describe("+2 AP сочленениям и визорам у Best.Q брони", () => {
  const withBonus = { ...emptyArmorLocFlags(), qualityJointAp: 2 };
  const base = { baseArmorAP: 9, damageType: "impact" };

  it("сочленение: ⌊9/3⌋ + 2 = 5 (бонус ПОСЛЕ уменьшения)", () => {
    expect(resolveArmorAbsorptionAP({ ...base, hitLocation: "Сочленение / Шея", flags: withBonus })).toBe(5);
  });
  it("без бонуса — обычные 3", () => {
    expect(resolveArmorAbsorptionAP({ ...base, hitLocation: "Сочленение / Шея", flags: emptyArmorLocFlags() })).toBe(3);
  });
  it("броня без сочленений (Мягкая): сочленений нет — бонуса нет, полный AP", () => {
    const soft = { ...withBonus, noJointReduction: true };
    expect(resolveArmorAbsorptionAP({ ...base, hitLocation: "Сочленение / Шея", flags: soft })).toBe(9);
  });
  it("визор (Глаз): AP шлема не считается, но +2 от Высшего качества остаётся", () => {
    expect(resolveArmorAbsorptionAP({ ...base, hitLocation: "Глаз (Голова)", flags: withBonus })).toBe(2);
  });
  it("прочие части тела бонус не получают", () => {
    expect(resolveArmorAbsorptionAP({ ...base, hitLocation: "Торс", flags: withBonus })).toBe(9);
  });
  it("слияние флагов предметов берёт больший, а не сумму", () => {
    const m = mergeArmorLocFlags(withBonus, { ...emptyArmorLocFlags(), qualityJointAp: 2 });
    expect(m.qualityJointAp).toBe(2);
  });
});

import { armorQualityAgilityPenalty } from "../../module/constants/quality.mjs";
import { poorArmourAgilityPenalty } from "../../module/rules/situational.mjs";

describe("Poor.Q брони: −10 на все тесты Ловкости (стр. 165)", () => {
  it("надетая Poor.Q — −10, один раз даже при двух предметах", () => {
    expect(armorQualityAgilityPenalty([armor("poor")])).toBe(-10);
    expect(armorQualityAgilityPenalty([armor("poor"), armor("poor")])).toBe(-10);
  });
  it("Comm/Good/Best — без штрафа; снятая и друкхарийская — тоже", () => {
    expect(armorQualityAgilityPenalty([armor("common"), armor("good"), armor("best")])).toBe(0);
    expect(armorQualityAgilityPenalty([armor("poor", { equipped: false })])).toBe(0);
    expect(armorQualityAgilityPenalty([armor("poor", { drukhari: true })])).toBe(0);
  });
  it("в ситуативные правила: только тест Ловкости", () => {
    const actor = { items: [armor("poor")] };
    expect(poorArmourAgilityPenalty(actor, "ag")).toBe(-10);
    expect(poorArmourAgilityPenalty(actor, "AG")).toBe(-10);
    expect(poorArmourAgilityPenalty(actor, "s")).toBe(0);
    expect(poorArmourAgilityPenalty({ items: [armor("good")] }, "ag")).toBe(0);
  });
});

import { gearQualityRollMod } from "../../module/constants/quality.mjs";

describe("Качество прочего снаряжения: ±тесты «с этим снаряжением» (стр. 165)", () => {
  const gear = (quality, extra = {}) => ({ type: "gear", system: { quality, ...extra } });
  it("Poor −10, Good +5, Best +10", () => {
    expect(gearQualityRollMod(gear("poor"))?.value).toBe(-10);
    expect(gearQualityRollMod(gear("good"))?.value).toBe(5);
    expect(gearQualityRollMod(gear("best"))?.value).toBe(10);
  });
  it("Обычное — ничего", () => expect(gearQualityRollMod(gear("common"))).toBe(null));
  it("оружие, броня и щиты идут своими таблицами — не «прочее»", () => {
    for (const type of ["weapon", "armor", "forcefield"]) {
      expect(gearQualityRollMod({ type, system: { quality: "poor" } })).toBe(null);
    }
  });
  it("подпись называет уровень", () => {
    expect(gearQualityRollMod(gear("poor")).label).toContain("Poor.Q");
  });
});
