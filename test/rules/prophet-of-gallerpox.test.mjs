// test/rules/prophet-of-gallerpox.test.mjs
//
// wdbc-1rno.1: ядро Дара «Prophet of Gallerpox / Пророк Гэллерпокса» —
// штраф против ядов не-Нурглитам на сцене заражённой Vehicle/Ship-машины.
// Здесь только чистая часть (isGallerpoxInfectedMachine/
// gallerpoxPoisonPenaltyApplies) — без canvas/Foundry, см. шапку модуля.

import { describe, it, expect } from "vitest";
import { isGallerpoxInfectedMachine, gallerpoxPoisonPenaltyApplies }
  from "../../module/rules/prophet-of-gallerpox.mjs";

const vehicle = (infected) => ({ type: "vehicle", system: { gallerpoxInfected: infected } });
const ship    = (infected) => ({ type: "ship",    system: { gallerpoxInfected: infected } });
const actor   = (patronGod) => ({ type: "character", system: { patronGod } });

describe("isGallerpoxInfectedMachine", () => {
  it("заражённая Техника — true", () => {
    expect(isGallerpoxInfectedMachine(vehicle(true))).toBe(true);
  });

  it("заражённый Корабль — true", () => {
    expect(isGallerpoxInfectedMachine(ship(true))).toBe(true);
  });

  it("незаражённая машина — false", () => {
    expect(isGallerpoxInfectedMachine(vehicle(false))).toBe(false);
  });

  it("не Vehicle/Ship (даже с system.gallerpoxInfected=true где-то ещё) — false", () => {
    expect(isGallerpoxInfectedMachine({ type: "character", system: { gallerpoxInfected: true } })).toBe(false);
  });

  it("null/undefined актор — false, не бросает", () => {
    expect(isGallerpoxInfectedMachine(null)).toBe(false);
    expect(isGallerpoxInfectedMachine(undefined)).toBe(false);
  });
});

describe("gallerpoxPoisonPenaltyApplies", () => {
  it("Нурглит рядом с заражённой машиной — иммунен (RAW: штраф только не-Нурглитам)", () => {
    expect(gallerpoxPoisonPenaltyApplies(actor("nurgle"), [vehicle(true)])).toBe(false);
  });

  it("не-Нурглит рядом с заражённой Техникой — штраф применяется", () => {
    expect(gallerpoxPoisonPenaltyApplies(actor("khorne"), [vehicle(true)])).toBe(true);
  });

  it("без покровителя вообще (patronGod пуст) — тоже не-Нурглит, штраф применяется", () => {
    expect(gallerpoxPoisonPenaltyApplies(actor(""), [ship(true)])).toBe(true);
  });

  it("на сцене нет заражённых машин — штрафа нет", () => {
    expect(gallerpoxPoisonPenaltyApplies(actor("khorne"), [vehicle(false), ship(false)])).toBe(false);
  });

  it("пустой/отсутствующий список акторов сцены — штрафа нет, не бросает", () => {
    expect(gallerpoxPoisonPenaltyApplies(actor("khorne"), [])).toBe(false);
    expect(gallerpoxPoisonPenaltyApplies(actor("khorne"), undefined)).toBe(false);
  });

  it("две заражённые машины на сцене — не удваивается (RAW и не просит), просто true", () => {
    expect(gallerpoxPoisonPenaltyApplies(actor("khorne"), [vehicle(true), ship(true)])).toBe(true);
  });
});
