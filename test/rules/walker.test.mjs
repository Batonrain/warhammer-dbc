// test/rules/walker.test.mjs
//
// wdbc-6wzt — арифметика книжных правил Ходовой «Шагоход» (Книга Машин, девять
// пунктов; дословный текст — constants/vehicle.mjs::CHASSIS_FULL_NOTES.walker).
// Foundry здесь не нужен вовсе: rules/walker.mjs ничего у него не спрашивает.

import { describe, it, expect } from "vitest";
import {
  isWalkerVehicle, walkerDefenceMod, walkerDodgeThresholds, walkerTurnsPerRound,
  hasCombatMasterTalent, walkerChargeDistance, walkerChargeMark, isWalkerChargeActive,
  knockdownOutcomeFor, tipOverDamageFormula, tipOverArmour, tipOverLedgeBonus,
  isTippedOver, TIP_OVER_LABEL
} from "../../module/rules/walker.mjs";

const walker  = (over = {}) => ({ type: "vehicle", system: { chassis: { type: "walker" }, ...over } });
const tracked = (over = {}) => ({ type: "vehicle", system: { chassis: { type: "tracked" }, ...over } });

describe("isWalkerVehicle", () => {
  it("узнаёт Шагоход по шасси", () => {
    expect(isWalkerVehicle(walker())).toBe(true);
  });

  it("прочие шасси Шагоходом не считает", () => {
    expect(isWalkerVehicle(tracked())).toBe(false);
    expect(isWalkerVehicle({ type: "vehicle", system: { chassis: { type: "skimmer" } } })).toBe(false);
  });

  it("персонаж с текстом «walker» где угодно Шагоходом не становится", () => {
    expect(isWalkerVehicle({ type: "character", system: { chassis: { type: "walker" } } })).toBe(false);
  });

  it("машина без Ходовой и пустой ввод не роняют проверку", () => {
    expect(isWalkerVehicle({ type: "vehicle", system: {} })).toBe(false);
    expect(isWalkerVehicle(null)).toBe(false);
  });
});

// п.5: «Может Парировать и Уклоняться со штрафом −Размер×10; Уклонение всегда
// комбинированное с Operate−10.»
describe("п.5 — штраф Избегания и комбинированное Уклонение", () => {
  it("штраф равен −Размер×10", () => {
    expect(walkerDefenceMod(4)).toBe(-40);
    expect(walkerDefenceMod(0)).toBe(-0);
  });

  it("Порог Уклонения — наименьший из двух Пределов (корбук, стр. 25)", () => {
    // Уклонение пилота 55 − Размер 4×10 = 15; Operate машины 40 − 10 = 30.
    const r = walkerDodgeThresholds({ dodgeBase: 55, size: 4, operate: 40 });
    expect(r.dodgePart).toBe(15);
    expect(r.operatePart).toBe(30);
    expect(r.threshold).toBe(15);
  });

  it("ниже может оказаться и половина Operate — тогда бросок против неё", () => {
    const r = walkerDodgeThresholds({ dodgeBase: 70, size: 1, operate: 25 });
    expect(r.dodgePart).toBe(60);
    expect(r.operatePart).toBe(15);
    expect(r.threshold).toBe(15);
  });

  it("−Размер×10 бьёт только по половине Уклонения, Operate теряет ровно 10", () => {
    const small = walkerDodgeThresholds({ dodgeBase: 50, size: 2, operate: 50 });
    const big   = walkerDodgeThresholds({ dodgeBase: 50, size: 6, operate: 50 });
    expect(small.operatePart).toBe(big.operatePart);   // Размер сюда не входит
    expect(small.dodgePart - big.dodgePart).toBe(40);  // и входит только сюда
  });
});

// п.8: «Раз в Раунд вне своего Хода может повернуться на до 180°… Талант Combat
// Master позволяет пилоту делать это до ½WS.b (окр. вверх) раз в Раунд.»
describe("п.8 — сколько поворотов вне Хода за Раунд", () => {
  it("без Таланта — ровно один", () => {
    expect(walkerTurnsPerRound({ combatMaster: false, wsBonus: 8 })).toBe(1);
  });

  it("с Талантом — ½WS.b, округление ВВЕРХ", () => {
    expect(walkerTurnsPerRound({ combatMaster: true, wsBonus: 4 })).toBe(2);
    expect(walkerTurnsPerRound({ combatMaster: true, wsBonus: 5 })).toBe(3);
    expect(walkerTurnsPerRound({ combatMaster: true, wsBonus: 7 })).toBe(4);
  });

  it("Талант никогда не отнимает поворот у слабого пилота", () => {
    // ½ от нуля — ноль; книга даёт Талант как усиление, а не как запрет.
    expect(walkerTurnsPerRound({ combatMaster: true, wsBonus: 0 })).toBe(1);
    expect(walkerTurnsPerRound({ combatMaster: true, wsBonus: 1 })).toBe(1);
  });

  it("Талант узнаётся по предмету-Таланту, а не по любому предмету с таким словом", () => {
    expect(hasCombatMasterTalent([{ type: "talent", name: "Combat Master / Мастер Боя" }])).toBe(true);
    expect(hasCombatMasterTalent([{ type: "talent", name: "Мастер Боя" }])).toBe(true);
    expect(hasCombatMasterTalent([{ type: "gear", name: "Combat Master" }])).toBe(false);
    expect(hasCombatMasterTalent([{ type: "talent", name: "Sure Strike" }])).toBe(false);
    expect(hasCombatMasterTalent([])).toBe(false);
  });
});

// п.1: «может в ближний бой, включая Натиск».
describe("п.1 — Натиск", () => {
  it("дистанция — SPD×3, но не меньше 4 м (как у персонажа)", () => {
    expect(walkerChargeDistance(6)).toBe(18);
    expect(walkerChargeDistance(1)).toBe(4);
    expect(walkerChargeDistance(0)).toBe(4);
  });

  it("метка действует в том же бою и том же Раунде", () => {
    const mark = walkerChargeMark({ combatId: "c1", round: 3 });
    expect(isWalkerChargeActive(mark, { combatId: "c1", round: 3 })).toBe(true);
  });

  it("следующий Раунд гасит метку сам — сбрасывать вручную нечего", () => {
    const mark = walkerChargeMark({ combatId: "c1", round: 3 });
    expect(isWalkerChargeActive(mark, { combatId: "c1", round: 4 })).toBe(false);
  });

  it("другой бой — не тот Натиск", () => {
    const mark = walkerChargeMark({ combatId: "c1", round: 3 });
    expect(isWalkerChargeActive(mark, { combatId: "c2", round: 3 })).toBe(false);
  });

  it("вне боя метка живёт: Раунды считать нечем", () => {
    const mark = walkerChargeMark({ combatId: "", round: 0 });
    expect(isWalkerChargeActive(mark, { combatId: "", round: 0 })).toBe(true);
  });

  it("метки нет — Натиска нет", () => {
    expect(isWalkerChargeActive(null, { combatId: "c1", round: 1 })).toBe(false);
  });
});

// п.2: «Вместо сбивания с ног — Опрокидывается.»
describe("п.2 — Опрокидывание вместо сбивания с ног", () => {
  it("толчок валит Шагоход Опрокидыванием, прочих — обычным сбиванием", () => {
    expect(knockdownOutcomeFor(walker())).toBe("tipOver");
    expect(knockdownOutcomeFor(tracked())).toBe("prone");
    expect(knockdownOutcomeFor({ type: "character", system: {} })).toBe("prone");
  });

  it("урон — <Размер>d10", () => {
    expect(tipOverDamageFormula(4)).toBe("4d10");
    expect(tipOverDamageFormula(6)).toBe("6d10");
  });

  it("у машины Размера 0 всё равно есть чему падать — 1d10, а не 0d10", () => {
    expect(tipOverDamageFormula(0)).toBe("1d10");
  });

  it("АР приземлившейся стороны вдвое ниже, округление ВВЕРХ", () => {
    expect(tipOverArmour(20)).toBe(10);
    expect(tipOverArmour(15)).toBe(8);
    expect(tipOverArmour(0)).toBe(0);
  });

  it("с уступа +1 урон за каждые ПОЛНЫЕ ½ м", () => {
    expect(tipOverLedgeBonus(0)).toBe(0);
    expect(tipOverLedgeBonus(0.4)).toBe(0);
    expect(tipOverLedgeBonus(0.5)).toBe(1);
    expect(tipOverLedgeBonus(3)).toBe(6);
    expect(tipOverLedgeBonus(-2)).toBe(0);
  });

  it("Опрокинутость читается строкой состояния машины, а не отдельным полем", () => {
    expect(isTippedOver(walker({ damageStates: [{ label: TIP_OVER_LABEL }] }))).toBe(true);
    expect(isTippedOver(walker({ damageStates: [{ label: "Пожар" }] }))).toBe(false);
    expect(isTippedOver(walker())).toBe(false);
  });
});
