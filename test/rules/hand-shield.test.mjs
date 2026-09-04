// test/rules/hand-shield.test.mjs
//
// Ручные щиты (корбук стр. 215, wdbc-in4d). Разбор book-записи зон
// («Т+Р1+Р2+Н1+Н2+(Г)») в локации брони и подсчёт AP щитов по актору:
// module/combat/hand-shield.mjs. Раньше тестов на этот файл не было вообще —
// проверялась только занятость руки (test/rules/hands.test.mjs) и гейт
// «Защитной Стойки» (test/sheets/attack-dialog.test.mjs), не сам парсинг.

import { describe, it, expect } from "vitest";
import {
  parseShieldZones, isHandShield, shieldArmorByLocation, shieldCoverageLabel
} from "../../module/combat/hand-shield.mjs";

const flags = {};
const item = (type, over = {}) => ({
  type, id: over.id ?? "it1", name: over.name ?? "Предмет",
  system: { equipped: true, weaponClass: "melee", grips: "", weaponProps: [], ...over.system },
  getFlag: (ns, key) => (flags[over.id ?? "it1"] || {})[key],
  setFlag: async (ns, key, val) => { (flags[over.id ?? "it1"] ||= {})[key] = val; return val; }
});
const shield = over => item("weapon", over);
const actor = (items = []) => ({ items });

describe("parseShieldZones", () => {
  it("простая полная зона без скобок (Тарг: «Р1»)", () => {
    const z = parseShieldZones("Р1", "left");
    expect(z.full).toEqual(["leftArm"]);
    expect(z.partial).toEqual([]);
    expect(z.variants).toEqual([]);
  });

  it("Р1 (рука со щитом) зависит от того, в какой руке щит", () => {
    const left = parseShieldZones("Р1", "left");
    expect(left.full).toEqual(["leftArm"]);
    const right = parseShieldZones("Р1", "right");
    expect(right.full).toEqual(["rightArm"]);
  });

  it("Р2 (вторая, свободная рука) — противоположна Р1", () => {
    const left = parseShieldZones("Р2", "left");
    expect(left.full).toEqual(["rightArm"]);
    const right = parseShieldZones("Р2", "right");
    expect(right.full).toEqual(["leftArm"]);
  });

  it("частичная зона в скобках — отдельно от full (Оцепительный: «Т+Р1+Н1+Н2+(Г+Р2)»)", () => {
    const z = parseShieldZones("Т+Р1+Н1+Н2+(Г+Р2)", "left");
    expect(z.full.sort()).toEqual(["body", "leftArm", "leftLeg", "rightLeg"]);
    expect(z.partial.sort()).toEqual(["head", "rightArm"]);
    expect(z.variants).toEqual([]);
  });

  it("взаимоисключающие варианты «(Г)/(Н1+Н2)» (Каплевидный щит)", () => {
    const z = parseShieldZones("Т+Р1+(Г)/(Н1+Н2)", "left");
    expect(z.full.sort()).toEqual(["body", "leftArm"]);
    expect(z.partial).toEqual([]);
    expect(z.variants).toEqual([[["head"], ["leftLeg", "rightLeg"]]]);
  });

  it("«Все»/«Всё тело» — все локации сразу (Эльдарский Силовой Щит)", () => {
    const z = parseShieldZones("Все", "left");
    expect(z.full.sort()).toEqual(
      ["body", "head", "leftArm", "leftLeg", "rightArm", "rightLeg"]
    );
    const z2 = parseShieldZones("Всё тело", "right");
    expect(z2.full.length).toBe(6);
  });

  it("«Как у стандартного» (донор-щит, Рунический/Президиум Протектива) — известная дыра, пусто", () => {
    const z = parseShieldZones("Как у стандартного", "left");
    expect(z.full).toEqual([]);
    expect(z.partial).toEqual([]);
    expect(z.variants).toEqual([]);
  });

  it("пустая строка (Баклер, AP 0) — ничего не прикрывает", () => {
    const z = parseShieldZones("", "left");
    expect(z.full).toEqual([]);
  });
});

describe("isHandShield", () => {
  it("shieldAP не null (даже 0) — щит", () => {
    expect(isHandShield(shield({ system: { shieldAP: 0 } }))).toBe(true);
    expect(isHandShield(shield({ system: { shieldAP: 4 } }))).toBe(true);
  });
  it("shieldAP null/отсутствует — не щит", () => {
    expect(isHandShield(shield({ system: { shieldAP: null } }))).toBe(false);
    expect(isHandShield(shield())).toBe(false);
  });
  it("не оружие (armor) — не щит, даже с shieldAP", () => {
    expect(isHandShield(item("armor", { system: { shieldAP: 3 } }))).toBe(false);
  });
});

describe("shieldArmorByLocation", () => {
  it("экипированный щит даёт AP на full-зоны", () => {
    const s = shield({ id: "s1", system: {
      shieldAP: 4, shieldZones: "Т+Р1+Н1+Н2+(Г+Р2)", equipped: true
    } });
    const a = actor([s]);
    const ap = shieldArmorByLocation(a);
    expect(ap.body).toBe(4);
    expect(ap.leftArm).toBe(4);
    expect(ap.leftLeg).toBe(4);
    expect(ap.rightLeg).toBe(4);
    // Голова и вторая рука — только частично, без поднятого щита не считаются.
    expect(ap.head).toBe(0);
    expect(ap.rightArm).toBe(0);
  });

  it("неэкипированный щит брони не даёт", () => {
    const s = shield({ id: "s1", system: {
      shieldAP: 4, shieldZones: "Р1", equipped: false
    } });
    const a = actor([s]);
    expect(shieldArmorByLocation(a).leftArm).toBe(0);
  });

  it("флаг shieldRaised подключает partial-зоны (Черта «поднять щит»)", async () => {
    const s = shield({ id: "s1", system: {
      shieldAP: 4, shieldZones: "Т+Р1+Н1+Н2+(Г+Р2)", equipped: true
    } });
    await s.setFlag("warhammer-dbc", "shieldRaised", true);
    const ap = shieldArmorByLocation(actor([s]));
    expect(ap.head).toBe(4);
    expect(ap.rightArm).toBe(4);
  });

  it("shieldRaised + variants — берётся выбранный вариант (shieldVariant), по умолчанию первый", async () => {
    const s = shield({ id: "s1", system: {
      shieldAP: 2, shieldZones: "Т+Р1+(Г)/(Н1+Н2)", equipped: true
    } });
    await s.setFlag("warhammer-dbc", "shieldRaised", true);
    let ap = shieldArmorByLocation(actor([s]));
    expect(ap.head).toBe(2);
    expect(ap.leftLeg || 0).toBe(0);

    await s.setFlag("warhammer-dbc", "shieldVariant", 1);
    ap = shieldArmorByLocation(actor([s]));
    expect(ap.leftLeg).toBe(2);
    expect(ap.rightLeg).toBe(2);
    expect(ap.head || 0).toBe(0);
  });

  it("AP щита НЕ суммируется с другим AP на той же зоне — берётся максимум", () => {
    const s1 = shield({ id: "s1", system: { shieldAP: 3, shieldZones: "Р1", equipped: true } });
    const s2 = shield({ id: "s2", system: { shieldAP: 5, shieldZones: "Р1", equipped: true } });
    // Второй «щит» на той же условной локации (в реальной игре второй щит
    // рукой не наденешь — тест только проверяет формулу max(), не игровую
    // легальность двух щитов).
    const ap = shieldArmorByLocation(actor([s1, s2]));
    expect(ap.leftArm).toBe(5);
  });

  it("AP 0 (Баклер) не считается источником брони, но и не роняет расчёт", () => {
    const s = shield({ id: "s1", system: { shieldAP: 0, shieldZones: "", equipped: true } });
    const ap = shieldArmorByLocation(actor([s]));
    expect(Object.values(ap).every(v => v === 0)).toBe(true);
  });

  it("сторона щита берётся из руки, в которой он надет (getHeldHand)", async () => {
    const s = shield({ id: "s1", system: { shieldAP: 4, shieldZones: "Р1", equipped: true } });
    await s.setFlag("warhammer-dbc", "heldHand", "right");
    const ap = shieldArmorByLocation(actor([s]));
    expect(ap.rightArm).toBe(4);
    expect(ap.leftArm).toBe(0);
  });
});

describe("shieldCoverageLabel", () => {
  it("не щит — пустая строка", () => {
    expect(shieldCoverageLabel(shield({ system: { shieldAP: null } }))).toBe("");
  });
  it("полные/частичные/варианты собираются в человекочитаемую строку", () => {
    const s = shield({ system: { shieldAP: 4, shieldZones: "Т+Р1+Н1+Н2+(Г+Р2)" } });
    const label = shieldCoverageLabel(s);
    expect(label).toContain("Торс");
    expect(label).toContain("частично:");
    expect(label).toContain("Голова");
  });
});
