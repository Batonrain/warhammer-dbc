// Лакрималлус: трупы на тралла, Цепи Производства, Трудовидец, Сборочная Линия,
// Разгон Траллов, Кибер-Пастырь (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  corpsesPerThrall, chainsShiftOutcome, chainsCap, toilseerCrew, assemblyLineSuccesses,
  overclockMagnitudeLoss, cyberShepherdReach, isTechThrall
} from "../../module/rules/lacrimallus-talents.mjs";
import { commandReachFor } from "../../module/rules/command.mjs";

const horde = (name, mag, extra = {}) => ({ type: "horde", name, items: [], system: { magnitude: { value: mag } }, ...extra });
const minion = name => ({ type: "minion", name, items: [] });

describe("трупы на тралла", () => {
  it("Киберобъятья: 3/2/1", () => {
    expect([1, 3, 4, 6, 7, 10].map(r => corpsesPerThrall(r))).toEqual([3, 3, 2, 2, 1, 1]);
  });
  it("Бесчеловечные Ресурсы: 2 на 1–5, 1 на 6+; ксеносы — как обычно", () => {
    expect([1, 5, 6].map(r => corpsesPerThrall(r, { inhuman: true }))).toEqual([2, 2, 1]);
    expect(corpsesPerThrall(5, { inhuman: true, xenos: true })).toBe(2);
    expect(corpsesPerThrall(2, { inhuman: true, xenos: true })).toBe(3);
  });
});

describe("Цепи Производства", () => {
  it("улучшенные умирают на 1–3, лимит P.b", () => {
    expect(chainsShiftOutcome([1, 3, 4, 10])).toEqual({ dead: 2, alive: 2 });
    expect(chainsCap(4)).toBe(4);
  });
});

describe("Трудовидец и Сборочная Линия", () => {
  it("Миньон — 1, Орда — 1 за полные 5 Магнитуды", () => {
    expect(toilseerCrew([minion("Сервитор"), horde("Тех-траллы", 12)])).toMatchObject({ assistants: 3, brigades: 3 });
  });
  it("Успехи Линии — 1 за 3 Магнитуды Орды тех-траллов", () => {
    expect(assemblyLineSuccesses([horde("Тех-траллы", 10), horde("Тех-траллы Б", 6), horde("Культисты", 30)])).toBe(5);
  });
});

describe("Разгон Траллов", () => {
  it("Орда теряет 1 Магнитуду за полные 10", () => {
    expect(overclockMagnitudeLoss(9)).toBe(0);
    expect(overclockMagnitudeLoss(25)).toBe(2);
  });
});

describe("Кибер-Пастырь", () => {
  const boss = { items: [{ type: "talent", name: "Cyber-Shepherd / Кибер-Пастырь" }] };
  const thralls = horde("Тех-траллы", 10, { flags: { "warhammer-dbc": { commandedBy: { uuid: "Actor.boss" } } } });
  const resolve = u => (u === "Actor.boss" ? boss : null);
  it("Орда тех-траллов командира с Талантом — получает Команды", () => {
    expect(isTechThrall(thralls)).toBe(true);
    expect(cyberShepherdReach(thralls, resolve)).toBe(true);
    expect(cyberShepherdReach(horde("Культисты", 10, { flags: thralls.flags }), resolve)).toBe(false);
  });
  it("commandReachFor: Команды и все три эффекта Присутствия", () => {
    globalThis.fromUuidSync = resolve;
    const r = commandReachFor("horde", "", thralls);
    expect(r.commands).toBe(true);
    expect(r.presence).toEqual(["extreme", "focus", "morale"]);
    expect(commandReachFor("horde", "", horde("Культисты", 10)).commands).toBe(false);
    delete globalThis.fromUuidSync;
  });
});
