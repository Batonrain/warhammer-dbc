// Архимагос: машинные слуги, Конкордакс, калибровка Доктрины, цены Когниции,
// Фрейм Шедевра и Цепи Производства в Мастерской (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  isMachineServant, concordaxBonus, isToughnessTest, calibrationChanges, calibrationValue,
  avatarOfMetalCost, avatarProcessCost, AVATAR_FLAG, doctrinaAssistantCap, ARCH_DOMINUS_COMMAND_COST
} from "../../module/rules/archmagos-talents.mjs";
import { processCostTotal } from "../../module/rules/technomystic-talents.mjs";
import { masterpieceBank, mechanicusCraftShift, masterpieceEligible } from "../../module/rules/mechanicus-craft.mjs";

const trait = name => ({ type: "trait", name });
const talent = name => ({ type: "talent", name });
const implant = category => ({ type: "implant", name: "Имплант", system: { category } });
const machine = trait("Machine (4) / Машина (4)");
const daemonic = trait("Daemonic (2) / Демонический (2)");

describe("машинный слуга Архимагоса", () => {
  it("Машина или Импланты Механикум — да, прочие — нет", () => {
    expect(isMachineServant({ items: [machine] })).toBe(true);
    expect(isMachineServant({ items: [implant("mechanicus")] })).toBe(true);
    expect(isMachineServant({ items: [implant("bioimplant")] })).toBe(false);
    expect(isMachineServant({ items: [] })).toBe(false);
  });
  it("демоническая машина — машина только с Инфернаксом", () => {
    const engine = { items: [machine, daemonic] };
    expect(isMachineServant(engine)).toBe(false);
    expect(isMachineServant(engine, { infernax: true })).toBe(true);
  });
});

describe("Конкордакс", () => {
  it("бонус = число слуг + сам Архимагос; кроме тестов T", () => {
    expect(concordaxBonus(0)).toBe(1);
    expect(concordaxBonus(4)).toBe(5);
    expect(isToughnessTest({ char: "t" })).toBe(true);
    expect(isToughnessTest({ char: "ws" })).toBe(false);
  });
});

describe("Доктрина Императив", () => {
  it("калибровка ±3×I.b парами WS↔BS, S↔A", () => {
    expect(calibrationValue(5)).toBe(15);
    expect(calibrationChanges("ws", 5)).toEqual([
      { key: "system.characteristics.ws.totalFx", type: "add", value: 15 },
      { key: "system.characteristics.bs.totalFx", type: "add", value: -15 }
    ]);
    expect(calibrationChanges("s", 4).map(c => c.key)).toEqual(["system.characteristics.s.totalFx", "system.characteristics.ag.totalFx"]);
    expect(calibrationChanges("nope", 4)).toEqual([]);
  });
  it("лимит ассистентов вдвое, только если все — машинные слуги", () => {
    expect(doctrinaAssistantCap(3, [{ items: [machine] }, { items: [implant("mechOther")] }])).toBe(6);
    expect(doctrinaAssistantCap(3, [{ items: [machine] }, { items: [] }])).toBe(3);
  });
});

describe("Аватар Металла и Архи-Доминус", () => {
  it("цена 2 ⚙, с Архи-Доминусом 1", () => {
    expect(avatarOfMetalCost({ items: [talent("Avatar of Metal / Аватар Металла")] })).toBe(2);
    expect(avatarOfMetalCost({ items: [talent("Arch-Dominus / Архи-Доминус")] })).toBe(1);
    expect(ARCH_DOMINUS_COMMAND_COST).toEqual({ short: 2, presence: 2, detail: 4 });
  });
  it("Процесс Аватара входит в цену Процессов, пока слуга под контролем", () => {
    const actor = { items: [talent("Avatar of Metal / Аватар Металла")], flags: {} };
    expect(avatarProcessCost(actor)).toBe(0);
    expect(processCostTotal(actor).total).toBe(0);
    actor.flags = { "warhammer-dbc": { [AVATAR_FLAG]: { uuid: "Actor.x", name: "Сервитор" } } };
    expect(avatarProcessCost(actor)).toBe(2);
    expect(processCostTotal(actor).total).toBe(2);
  });
});

describe("Мастерская: Фрейм Шедевра и Цепи Производства", () => {
  const frame = { items: [trait("Masterpiece Frame / Фрейм Шедевра")] };
  const proj = { mode: "craft", categoryKey: "bionics", masterpieceFrame: true };
  it("+30 и Банк вдвое (вверх) только на бионике и по выбору", () => {
    expect(masterpieceEligible(frame, { ...proj, categoryKey: "weapons" })).toBe(false);
    expect(masterpieceBank(25, frame, proj)).toBe(13);
    expect(masterpieceBank(25, frame, { ...proj, masterpieceFrame: false })).toBe(25);
    expect(mechanicusCraftShift(frame, proj).bonus).toBe(30);
    expect(mechanicusCraftShift({ items: [] }, proj).bonus).toBe(0);
  });
  it("Цепи Производства — переброс теста Крафта", () => {
    const lac = { items: [talent("Chains of Production / Цепи Производства")] };
    expect(mechanicusCraftShift(lac, { mode: "craft" }).reroll).toBe(true);
    expect(mechanicusCraftShift(lac, { mode: "research" }).reroll).toBe(false);
  });
});
