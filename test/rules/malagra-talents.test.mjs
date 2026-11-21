// Малагра: Катушка Потенции, Совершенная Катушка и Йовекс в Техночудах,
// Жестокая Разрядка, Магнитоморфоз, начало Хода (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  astralConverterBase, astralRegen, paragonIntBonus, malagraMiracleMods, isLuminenPower,
  fellDischargeEffect, magnetoPlan, magnetoLift, PARAGON_FLAG
} from "../../module/rules/malagra-talents.mjs";
import { magnetoEffectData, processMalagraTurnStart } from "../../module/combat/malagra.mjs";

const trait = name => ({ type: "trait", name });
const talent = name => ({ type: "talent", name });
const NS = "warhammer-dbc";

const malagra = ({ items = [], energy = 5, paragon = true, per = 45 } = {}) => ({
  items,
  flags: paragon ? { [NS]: { [PARAGON_FLAG]: true } } : {},
  system: { energy: { value: energy, max: 0, maxTotal: 10 }, characteristics: { per: { total: per, bonus: Math.floor(per / 10) } } }
});

describe("Астральный Конвертер", () => {
  it("база Катушки 10 только с Чертой; +1 заряд не выше максимума", () => {
    expect(astralConverterBase({ items: [trait("Astral Converter / Астральный Конвертер")] })).toBe(10);
    expect(astralConverterBase({ items: [] })).toBe(0);
    expect(astralRegen({ value: 4, maxTotal: 10 })).toBe(1);
    expect(astralRegen({ value: 10, maxTotal: 10 })).toBe(0);
  });
});

describe("Совершенная Катушка и Йовекс", () => {
  it("½P и ½P.b (окр.▲), пока метка стоит и заряды есть", () => {
    expect(paragonIntBonus(malagra())).toEqual({ i: 23, ib: 2 });
    expect(paragonIntBonus(malagra({ energy: 0 }))).toEqual({ i: 0, ib: 0 });
    expect(paragonIntBonus(malagra({ paragon: false }))).toEqual({ i: 0, ib: 0 });
  });
  it("Йовекс — только Люминен-Техночудо при активной Катушке; отказ снимает", () => {
    const a = malagra({ items: [talent("Iovex / Йовекс")], per: 51 });
    const luminen = { name: "Luminen Shock / Люминен Шок" };
    expect(isLuminenPower(luminen)).toBe(true);
    const m = malagraMiracleMods(a, luminen);
    expect(m).toMatchObject({ extraDice: "1d10", pen: 3, autoFailComp: true, ib: 3 });
    expect(malagraMiracleMods(a, { name: "Ferric Commandment" }).extraDice).toBe("");
    expect(malagraMiracleMods(a, luminen, { iovex: false }).autoFailComp).toBe(false);
    expect(malagraMiracleMods(malagra({ items: [talent("Iovex")], paragon: false }), luminen).extraDice).toBe("");
  });
});

describe("Жестокая Разрядка и Магнитоморфоз", () => {
  it("1 урон за заряд, 1 Усталость за каждые полные 2", () => {
    expect(fellDischargeEffect(7)).toEqual({ damage: 7, fatigue: 3 });
    expect(fellDischargeEffect(0)).toEqual({ damage: 0, fatigue: 0 });
  });
  it("бюджет I.b и форма чудовищ только к кокону", () => {
    expect(magnetoPlan({ cocoon: 1, beast: 1 }, 5)).toEqual({ ok: true, spent: 5 });
    expect(magnetoPlan({ lift: 2 }, 5).ok).toBe(false);
    expect(magnetoPlan({ beast: 1 }, 5).ok).toBe(false);
    expect(magnetoLift(4)).toEqual({ kg: 200, m: 4 });
  });
  it("эффект: +AP всем частям за кокон, Страх 2 за форму", () => {
    const fx = magnetoEffectData({ cocoon: 2, beast: 1 });
    const keys = fx.system.changes.map(c => c.key);
    expect(keys.filter(k => k.startsWith("system.armorBonus.")).length).toBe(6);
    expect(fx.system.changes.find(c => c.key === "system.armorBonus.head").value).toBe(2);
    expect(fx.system.changes.find(c => c.key === "system.fearRating")).toMatchObject({ type: "upgrade", value: 2 });
    expect(magnetoEffectData({ hand: 1 })).toBeNull();
  });
});

describe("начало Хода Малагры", () => {
  it("+1 заряд, Катушка гаснет, Вэнефактор +1 ОД и Реакция", async () => {
    let upd = null;
    const a = {
      items: [trait("Astral Converter"), talent("Venefactor / Вэнефактор")],
      flags: { [NS]: { [PARAGON_FLAG]: true } },
      getFlag: (s, k) => a.flags[s]?.[k],
      system: { energy: { value: 3, maxTotal: 10 }, actionPoints: { value: 2 }, reactions: { value: 1 } },
      update: async u => { upd = u; }
    };
    await processMalagraTurnStart(a);
    expect(upd).toEqual({
      "system.energy.value": 4, [`flags.${NS}.-=${PARAGON_FLAG}`]: null,
      "system.actionPoints.value": 3, "system.reactions.value": 2
    });
  });
  it("Вэнефактор не даёт ОД запертому Ходу", async () => {
    let upd = null;
    const a = { items: [talent("Venefactor")], flags: {}, getFlag: () => undefined,
      system: { actionPoints: { value: 0 }, reactions: { value: 0 } }, update: async u => { upd = u; } };
    await processMalagraTurnStart(a);
    expect(upd).toBeNull();
  });
});
