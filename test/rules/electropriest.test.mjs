// Электрожрец: Катушки, Сила Из Плоти, Пузырь, щит (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  electropriestActive, coilsBare, coilsEnergyMaxBonus, coilsSpeedBonus, coilsInitiativeBonus, coilsTechBonus,
  electropriestRules, coilsDamageRefund, coilsBrutalCharge, voltagheistBlastProfile, bubbleProtects, shieldAblative, shieldAblativeChange,
  BUBBLE_FLAG, SHIELD_ABLATIVE_FLAG
} from "../../module/rules/electropriest.mjs";

const priest = ({ items = [], energy = 3, wb = 5, flags = {}, wounds = {} } = {}) => ({
  items: [{ type: "trait", name: "Electropriest Coils / Катушки Электрожреца" },
          { type: "trait", name: "Power From Flesh / Сила Из Плоти" },
          { type: "trait", name: "Hominis Frame / Фрейм Хоминис" }, ...items],
  system: { energy: { value: energy }, characteristics: { wp: { bonus: wb } }, wounds },
  flags: { "warhammer-dbc": flags }
});
const armour = ap => ({ type: "armor", system: { equipped: true, ...ap } });

describe("Катушки Электрожреца", () => {
  it("+W.b к максимуму заряда всегда", () => {
    expect(coilsEnergyMaxBonus(priest({ items: [armour({ body: 4 })] }))).toBe(5);
  });
  it("без брони на голове/торсе/руках — SPD, Инициатива, Уклонение", () => {
    const p = priest();
    expect(coilsBare(p)).toBe(true);
    expect(coilsSpeedBonus(p)).toBe(3);
    expect(coilsInitiativeBonus(p)).toBe(5);
    const r = electropriestRules(p);
    expect(r[0].effects[0]).toMatchObject({ target: "skill:dodge", value: 6, auto: true });
  });
  it("броня на ногах не мешает, на торсе — гасит", () => {
    expect(coilsBare(priest({ items: [armour({ leftLeg: 3 })] }))).toBe(true);
    const dressed = priest({ items: [armour({ body: 3 })] });
    expect(coilsSpeedBonus(dressed)).toBe(0);
    expect(electropriestRules(dressed)).toEqual([]);
  });
  it("Компенсатор Мотивотеургии +3×W.b, Люминен +½W.b к Dmg/Pen", () => {
    const p = priest();
    expect(coilsTechBonus(p, { type: "techPower", system: { discipline: "motivotheurgy", miracleType: "compensator" } }).test).toBe(15);
    const lum = coilsTechBonus(p, { type: "techPower", system: { subtype: "Люминен" } });
    expect(lum.dmg).toBe(3);
    expect(lum.pen).toBe(3);
  });
  it("Brutal Charge (½W.b, окр.▲) только рукопашному E(El) и без брони", () => {
    expect(coilsBrutalCharge(priest(), { isMelee: true, damageSubtype: "electrical" })).toBe(3);
    expect(coilsBrutalCharge(priest(), { isMelee: true, damageSubtype: "flame" })).toBe(0);
    expect(coilsBrutalCharge(priest(), { isMelee: false, damageSubtype: "electrical" })).toBe(0);
    expect(coilsBrutalCharge(priest({ items: [armour({ head: 2 })] }), { isMelee: true, damageSubtype: "electrical" })).toBe(0);
    expect(coilsBrutalCharge({ items: [], system: { characteristics: { wp: { bonus: 5 } } } }, { isMelee: true, damageSubtype: "electrical" })).toBe(0);
  });
  it("снижение урона: −W.b, но не ниже 1", () => {
    expect(coilsDamageRefund(priest(), 10)).toBe(5);
    expect(coilsDamageRefund(priest(), 3)).toBe(2);
  });
});

describe("Сила Из Плоти", () => {
  it("Трейт Machine гасит, Fleshmetal возвращает", () => {
    const m = priest({ items: [{ type: "trait", name: "Machine / Машина (X)" }] });
    expect(electropriestActive(m)).toBe(false);
    expect(coilsEnergyMaxBonus(m)).toBe(0);
    expect(electropriestActive(priest({ items: [{ type: "trait", name: "Machine" }, { type: "talent", name: "Fleshmetal / Плотеметалл" }] }))).toBe(true);
  });
});

describe("Вольтагейст Взрыв и Пузырь", () => {
  it("профиль взрыва: радиус ½W.b (окр.▲), 1d10+W.b", () => {
    expect(voltagheistBlastProfile(priest())).toMatchObject({ radius: 3, formula: "1d10+5", allies: 5 });
  });
  it("Пузырь в атмосфере защищает 15 минут, азотный — нет", () => {
    const bubble = f => priest({ items: [{ type: "talent", name: "Voltagheist Bubble / Вольтагейст Пузырь" }], flags: { [BUBBLE_FLAG]: f } });
    expect(bubbleProtects(bubble({ at: 100, vacuum: false }), 500)).toBe(true);
    expect(bubbleProtects(bubble({ at: 100, vacuum: false }), 100 + 901)).toBe(false);
    expect(bubbleProtects(bubble({ at: 100, vacuum: true }), 200)).toBe(false);
  });
});

describe("аблативные Раны щита", () => {
  it("вклад щита — меньшее из метки и пула; изменение двигает пул и максимум", () => {
    const p = priest({ flags: { [SHIELD_ABLATIVE_FLAG]: 10 }, wounds: { ablative: 6, ablativeMax: 12 } });
    expect(shieldAblative(p)).toBe(6);
    const ch = shieldAblativeChange(p, -1);
    expect(ch.contribution).toBe(5);
    expect(ch.update["system.wounds.ablative"]).toBe(5);
    expect(ch.update["system.wounds.ablativeMax"]).toBe(7);
  });
});
